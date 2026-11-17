import test from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { readFile } from "node:fs/promises";
import {
  saveWorkspace,
  loadWorkspace,
} from "../src/services/workspaceService.ts";
import { emptyWorkspace } from "../src/domain/workspace.ts";
import { defaultStore } from "../server/store.mjs";
import { getApps, deleteApp } from "firebase-admin/app";
process.env.FIREBASE_PROJECT_ID = "demo-syllabus-ai";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
const store = defaultStore();
const env = await initializeTestEnvironment({
  projectId: "demo-syllabus-ai",
  firestore: {
    host: "127.0.0.1",
    port: 8085,
    rules: await readFile("firestore.rules", "utf8"),
  },
});
const alice = env.authenticatedContext("alice").firestore(),
  bob = env.authenticatedContext("bob").firestore();
const state = () => ({ ...emptyWorkspace(), onboardingComplete: true });
test.after(async () => {
  await env.cleanup();
  await Promise.all(getApps().map(deleteApp));
});
test.beforeEach(async () => {
  await env.clearFirestore();
});
test("chunked workspace round trips and prevents stale revision overwrite", async () => {
  const initial = state();
  initial.subjects = Array.from({ length: 4 }, (_, i) => ({
    id: `s${i}`,
    name: "Course",
    color: "#7357ff",
    examDate: "2027-01-01",
    difficulty: "Medium",
    topics: Array.from({ length: 20 }, (_, j) => ({
      id: `t${j}`,
      title: "Topic",
      chapter: "Unit",
      priority: "Medium",
      minutes: 45,
      status: "Not started",
      revisionStatus: "New",
      notes: "x".repeat(4000),
    })),
  }));
  assert.equal(await saveWorkspace("alice", initial, 0, alice), 1);
  const saved = await loadWorkspace("alice", alice);
  assert.deepEqual(saved.state, initial);
  assert.equal(saved.revision, 1);
  await assert.rejects(
    saveWorkspace("alice", state(), 0, alice),
    /Another tab/,
  );
  assert.equal((await loadWorkspace("alice", alice)).state.subjects.length, 4);
  assert.equal(await saveWorkspace("alice", state(), 1, alice), 2);
  assert.equal(
    (await getDoc(doc(alice, "users/alice/workspaces/main/chunks/3"))).exists(),
    false,
  );
});
test("rules deny other accounts, anonymous reads and malformed manifests", async () => {
  await saveWorkspace("alice", state(), 0, alice);
  await assertFails(getDoc(doc(bob, "users/alice/workspaces/main")));
  await assertFails(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        "users/alice/workspaces/main",
      ),
    ),
  );
  await assertFails(
    setDoc(doc(alice, "users/alice/workspaces/main"), {
      schemaVersion: 2,
      revision: 99,
      chunkCount: 1,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(alice, "users/alice/workspaces/main/chunks/0"), {
      payload: "corrupt",
    }),
  );
});
test("legacy validators are enforced and original subjects migrate without sample progress", async () => {
  await assertFails(
    setDoc(doc(alice, "users/alice/syllabi/bad"), {
      name: "",
      examDate: "bad",
      dailyHours: -1,
    }),
  );
  await assertSucceeds(
    setDoc(doc(alice, "users/alice/syllabi/course"), {
      name: "Course",
      examDate: "2027-01-01",
      dailyHours: 2,
      createdAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    setDoc(doc(alice, "users/alice/syllabi/course/topics/t"), {
      title: "Graph",
      difficulty: "Hard",
      estimatedHours: 2,
    }),
  );
  const loaded = await loadWorkspace("alice", alice);
  assert.equal(loaded.state.subjects[0].topics[0].minutes, 120);
  assert.equal(loaded.state.studyLog.length, 0);
});

test("billing and delivery collections are inaccessible to browser clients", async () => {
  for (const path of [
    "billingAccounts/alice",
    "billingEvents/event",
    "notificationProfiles/alice",
    "notificationProfiles/alice/subscriptions/endpoint",
    "pushEndpoints/endpoint",
    "deliveryJobs/job",
  ]) {
    await assertFails(
      setDoc(doc(alice, path), { status: "active", uid: "alice" }),
    );
    await assertFails(getDoc(doc(alice, path)));
  }
});

test("durable delivery leases prevent concurrent sends and honor retry backoff", async () => {
  const claims = await Promise.all([
    store.claim("job", 1000),
    store.claim("job", 1000),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  await store.finish("job", "failed", 2000);
  assert.equal(await store.claim("job", 61000), false);
  assert.equal(await store.claim("job", 62000), true);
  await store.finish("job", "sent", 63000);
  assert.equal(await store.claim("job", 999999), false);
});

test("push ownership transfers atomically and previous owner cannot delete it", async () => {
  const subscription = {
    endpoint: "https://fcm.googleapis.com/test",
    keys: { auth: "test", p256dh: "test" },
  };
  await store.putSubscription("alice", "endpoint", subscription);
  await store.putSubscription("bob", "endpoint", subscription);
  assert.equal((await store.subscriptions("alice")).length, 0);
  await store.removeSubscription("alice", "endpoint");
  assert.equal(await store.ownsSubscription("bob", "endpoint"), true);
  assert.equal((await store.subscriptions("bob")).length, 1);
});

test("subscription updates deduplicate events and ignore stale subscription events atomically", async () => {
  await store.applySubscription(
    "new",
    "alice",
    { subscriptionId: "new", subscriptionCreated: 100, status: "active" },
    100,
  );
  await store.applySubscription(
    "new",
    "alice",
    { subscriptionId: "new", status: "canceled" },
    200,
  );
  await store.applySubscription(
    "old",
    "alice",
    { subscriptionId: "old", subscriptionCreated: 50, status: "canceled" },
    300,
  );
  await store.applySubscription(
    "older",
    "alice",
    { subscriptionId: "new", subscriptionCreated: 100, status: "past_due" },
    99,
  );
  assert.equal((await store.getAccount("alice")).status, "active");
  await store.applySubscription(
    "cancel",
    "alice",
    { subscriptionId: "new", subscriptionCreated: 100, status: "canceled" },
    301,
  );
  assert.equal((await store.getAccount("alice")).status, "canceled");
});
