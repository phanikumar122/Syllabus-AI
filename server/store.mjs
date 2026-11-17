import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
function app() {
  return (
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  );
}
export function defaultStore() {
  const db = () =>
    getFirestore(app(), process.env.VITE_FIREBASE_DATABASE_ID || "(default)");
  const ref = (collection, id) => db().collection(collection).doc(id);
  const read = async (collection, id) =>
    (await ref(collection, id).get()).data() || {};
  return {
    user: (uid) => getAuth(app()).getUser(uid),
    getAccount: (uid) => read("billingAccounts", uid),
    setAccount: (uid, data) =>
      ref("billingAccounts", uid).set(
        { ...data, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      ),
    getProfile: (uid) => read("notificationProfiles", uid),
    setProfile: (uid, data) =>
      ref("notificationProfiles", uid).set({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    profiles: async () => {
      const profiles = await db()
        .collection("notificationProfiles")
        .where("enabled", "==", true)
        .get();
      return profiles.docs.map((d) => ({ ...d.data(), uid: d.id }));
    },
    putSubscription: async (uid, id, subscription) => {
      const owner = ref("pushEndpoints", id);
      await db().runTransaction(async (tx) => {
        const known = await tx.get(owner);
        if (known.exists && known.data().uid !== uid) {
          const old = ref("notificationProfiles", known.data().uid)
            .collection("subscriptions")
            .doc(id);
          tx.delete(old);
        }
        tx.set(owner, { uid });
        tx.set(
          ref("notificationProfiles", uid).collection("subscriptions").doc(id),
          { subscription, createdAt: FieldValue.serverTimestamp() },
        );
      });
    },
    removeSubscription: async (uid, id) => {
      await db().runTransaction(async (tx) => {
        const endpoint = await tx.get(ref("pushEndpoints", id));
        tx.delete(
          ref("notificationProfiles", uid).collection("subscriptions").doc(id),
        );
        if (endpoint.data()?.uid === uid) tx.delete(endpoint.ref);
      });
    },
    ownsSubscription: async (uid, id) =>
      (await ref("pushEndpoints", id).get()).data()?.uid === uid,
    subscriptions: async (uid) =>
      (
        await ref("notificationProfiles", uid).collection("subscriptions").get()
      ).docs.map((d) => ({ id: d.id, subscription: d.data().subscription })),
    applySubscription: async (id, uid, data, created) =>
      db().runTransaction(async (tx) => {
        const event = ref("billingEvents", id),
          account = ref("billingAccounts", uid);
        const [seen, current] = await Promise.all([
          tx.get(event),
          tx.get(account),
        ]);
        if (seen.exists) return;
        const value = current.data() || {};
        const staleSubscription =
          value.subscriptionId &&
          value.subscriptionId !== data.subscriptionId &&
          ((data.subscriptionCreated || 0) < (value.subscriptionCreated || 0) ||
            (!["active", "trialing"].includes(data.status) &&
              ["active", "trialing"].includes(value.status)));
        if (!staleSubscription && created >= (value.lastEventCreated || 0))
          tx.set(
            account,
            {
              ...data,
              lastEventCreated: created,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        tx.set(event, {
          uid,
          created,
          processedAt: FieldValue.serverTimestamp(),
        });
      }),
    claim: async (key, now, leaseMs = 120000) =>
      db().runTransaction(async (tx) => {
        const target = ref("deliveryJobs", hash(key)),
          job = await tx.get(target);
        const value = job.data();
        if (
          value?.status === "sent" ||
          value?.leaseUntil > now ||
          value?.retryAt > now
        )
          return false;
        tx.set(
          target,
          {
            status: "sending",
            leaseUntil: now + leaseMs,
            attempts: (value?.attempts || 0) + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return true;
      }),
    finish: async (key, status, now, code = "") =>
      ref("deliveryJobs", hash(key)).set(
        {
          status,
          leaseUntil: 0,
          retryAt: status === "failed" ? now + 60000 : 0,
          lastCode: String(code).slice(0, 40),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
    getDelivery: async (key) => read("deliveryJobs", hash(key)),
    workspace: async (uid) =>
      db().runTransaction(async (tx) => {
        const workspace = ref("users", uid)
            .collection("workspaces")
            .doc("main"),
          snap = await tx.get(workspace),
          data = snap.data();
        if (!data) return null;
        if (data.schemaVersion === 1) return data.state;
        if (
          data.schemaVersion !== 2 ||
          !Number.isInteger(data.chunkCount) ||
          data.chunkCount < 1 ||
          data.chunkCount > 80
        )
          throw new Error("Invalid workspace");
        let json = "";
        for (let i = 0; i < data.chunkCount; i++) {
          const chunk = await tx.get(
            workspace.collection("chunks").doc(String(i)),
          );
          if (typeof chunk.data()?.payload !== "string")
            throw new Error("Incomplete workspace");
          json += chunk.data().payload;
          if (Buffer.byteLength(json) > 8_000_000)
            throw new Error("Workspace too large");
        }
        return JSON.parse(json);
      }),
  };
}
