import test from "node:test";
import assert from "node:assert/strict";
import {
  dueNotifications,
  runNotifications,
  toUtcMillis,
} from "../server/notifications.mjs";
const now = Date.parse("2026-11-16T04:15:00Z");
const profile = {
  uid: "u",
  email: "u@example.com",
  emailEnabled: true,
  pushEnabled: true,
  digestEnabled: false,
  timeZone: "Asia/Kolkata",
  leadMinutes: 15,
};
const workspace = {
  subjects: [
    { id: "s", name: "Physics", topics: [{ id: "t", title: "Motion" }] },
  ],
  sessions: [
    {
      id: "b",
      date: "2026-11-16",
      start: "10:00",
      duration: 45,
      status: "planned",
      subjectId: "s",
      topicId: "t",
    },
  ],
  studyLog: [],
};
test("session reminders use user time zone and skip completed or stale sessions", () => {
  const due = dueNotifications(profile, workspace, now);
  assert.equal(due.length, 1);
  assert.equal(due[0].title, "Time to study: Motion");
  assert.equal(
    dueNotifications(
      profile,
      {
        ...workspace,
        sessions: [{ ...workspace.sessions[0], status: "completed" }],
      },
      now,
    ).length,
    0,
  );
  assert.equal(
    dueNotifications(profile, workspace, now + 60 * 60 * 1000).length,
    0,
  );
  assert.equal(
    toUtcMillis("2026-11-16", "10:00", "Asia/Kolkata"),
    Date.parse("2026-11-16T04:30:00Z"),
  );
});
test("weekly digest reflects recorded prior week, not sample numbers", () => {
  const due = dueNotifications(
    { ...profile, digestEnabled: true },
    {
      ...workspace,
      studyLog: [
        { date: "2026-11-10", hours: 2 },
        { date: "2026-11-15", hours: 3 },
        { date: "2026-11-16", hours: 9 },
      ],
    },
    Date.parse("2026-11-16T03:30:00Z"),
  );
  assert.equal(due.find((v) => v.kind === "digest").hours, 5);
});
function memory() {
  const jobs = new Map();
  let removed = 0;
  return {
    profiles: async () => [profile],
    workspace: async () => workspace,
    user: async () => ({ emailVerified: true, email: profile.email }),
    getAccount: async () => ({ status: "active" }),
    subscriptions: async () => [
      {
        id: "p",
        subscription: { endpoint: "https://fcm.googleapis.com/x", keys: {} },
      },
    ],
    claim: async (key, time) => {
      if (jobs.get(key) === "sent" || jobs.get(key) === "sending") return false;
      jobs.set(key, "sending");
      return true;
    },
    finish: async (key, status) => jobs.set(key, status),
    removeSubscription: async () => {
      removed++;
    },
    removed: () => removed,
  };
}
test("worker deduplicates repeated ticks and independent channel delivery", async () => {
  const store = memory();
  let emails = 0,
    pushes = 0;
  const options = {
    store,
    now,
    config: { smtpReady: true, pushReady: true, billingRequired: true },
    sendEmail: async () => emails++,
    sendPush: async () => pushes++,
  };
  await runNotifications(options);
  await runNotifications(options);
  assert.equal(emails, 1);
  assert.equal(pushes, 1);
});
test("failed email retries without repeating successful push, expired push is removed", async () => {
  const store = memory();
  let emails = 0,
    pushes = 0;
  const options = {
    store,
    now,
    config: { smtpReady: true, pushReady: true },
    sendEmail: async () => {
      emails++;
      if (emails === 1) throw new Error("SMTP unavailable");
    },
    sendPush: async () => {
      pushes++;
      throw Object.assign(new Error("Expired"), { statusCode: 410 });
    },
  };
  await runNotifications(options);
  await runNotifications(options);
  assert.equal(emails, 2);
  assert.equal(pushes, 1);
  assert.equal(store.removed(), 1);
});
