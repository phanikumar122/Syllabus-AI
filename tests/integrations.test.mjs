import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../server/api.mjs";
import Stripe from "stripe";
const settings = {
  emailEnabled: true,
  pushEnabled: false,
  digestEnabled: true,
  timeZone: "Asia/Kolkata",
  leadMinutes: 15,
};
function fixtures() {
  const accounts = new Map(),
    profiles = new Map(),
    events = new Set(),
    subs = new Map();
  return {
    user: async (uid) => ({
      uid,
      email: `${uid}@example.com`,
      emailVerified: true,
    }),
    getAccount: async (uid) => accounts.get(uid) || {},
    setAccount: async (uid, v) =>
      accounts.set(uid, { ...accounts.get(uid), ...v }),
    getProfile: async (uid) => profiles.get(uid) || {},
    setProfile: async (uid, v) => profiles.set(uid, v),
    putSubscription: async (uid, id, v) => subs.set(uid + id, v),
    removeSubscription: async (uid, id) => subs.delete(uid + id),
    subscriptions: async (uid) =>
      [...subs]
        .filter(([key]) => key.startsWith(uid))
        .map(([id, subscription]) => ({
          id: id.slice(uid.length),
          subscription,
        })),
    applySubscription: async (id, uid, data, created) => {
      if (events.has(id)) return;
      events.add(id);
      if (created >= (accounts.get(uid)?.lastEventCreated || 0))
        accounts.set(uid, {
          ...accounts.get(uid),
          ...data,
          lastEventCreated: created,
        });
    },
    claim: async () => true,
    finish: async () => {},
    getDelivery: async () => null,
  };
}
const config = {
  appUrl: "http://localhost:3000",
  stripePriceId: "price_study",
  stripeWebhookSecret: "test_secret",
  smtpReady: true,
  pushReady: true,
  workerEnabled: true,
  vapidPublicKey: "public",
  billingRequired: true,
};
const stripe = {
  customers: { create: async () => ({ id: "cus_alice" }) },
  prices: {
    retrieve: async () => ({
      id: "price_study",
      active: true,
      type: "recurring",
      unit_amount: 900,
      currency: "usd",
      recurring: { interval: "month" },
    }),
  },
  checkout: {
    sessions: {
      create: async (params) => ({
        id: "cs_test",
        url: "https://checkout.stripe.com/test",
        params,
      }),
      retrieve: async () => ({ status: "expired" }),
    },
  },
  billingPortal: {
    sessions: {
      create: async () => ({ url: "https://billing.stripe.com/test" }),
    },
  },
  subscriptions: {
    retrieve: async (id) => ({
      id,
      status: "active",
      customer: "cus_alice",
      metadata: { uid: "alice" },
      items: { data: [{ price: { id: "price_study" } }] },
    }),
  },
  webhooks: {
    constructEvent: (body, signature) => {
      if (signature !== "valid") throw new Error("invalid");
      return JSON.parse(body.toString());
    },
  },
};
async function run(options, action) {
  const server = createApi({
    authenticate: async () => "alice",
    ...options,
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await action(`http://127.0.0.1:${server.address().port}/api`);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
const request = (base, path, body, token = "test") =>
  fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test("account services, portal and notification preferences complete their authenticated workflows", async () => {
  const store = fixtures();
  await store.setAccount("alice", {
    customerId: "cus_alice",
    status: "active",
  });
  let recipient = "";
  await run(
    {
      store,
      stripe,
      serviceConfig: config,
      sendEmail: async (message) => {
        recipient = message.to;
      },
      sendPush: async () => {},
    },
    async (base) => {
      assert.equal(
        (await (await request(base, "/account/services")).json())
          .billingConfigured,
        true,
      );
      const status = await (await request(base, "/billing/status")).json();
      assert.equal(status.premium, true);
      assert.equal(status.price.amount, 900);
      assert.equal(
        (await (await request(base, "/billing/portal", {})).json()).url,
        "https://billing.stripe.com/test",
      );
      assert.equal(
        (await request(base, "/billing/checkout", { requestId: "duplicate" }))
          .status,
        409,
      );
      assert.equal(
        (
          await request(base, "/notifications/preferences", {
            ...settings,
            pushEnabled: true,
          })
        ).status,
        200,
      );
      const preferences = await (
        await request(base, "/notifications/preferences")
      ).json();
      assert.equal(preferences.email, "alice@example.com");
      assert.equal(preferences.timeZone, "Asia/Kolkata");
      assert.equal(
        (await (await request(base, "/notifications/push-key")).json())
          .publicKey,
        "public",
      );
      const subscription = {
        endpoint: "https://fcm.googleapis.com/browser-test",
        keys: { p256dh: "A".repeat(87), auth: "A".repeat(22) },
      };
      assert.equal(
        (await request(base, "/notifications/subscribe", subscription)).status,
        200,
      );
      assert.equal(
        (await request(base, "/notifications/test-email", {})).status,
        200,
      );
      assert.equal(recipient, "alice@example.com");
      assert.equal(
        (await (await request(base, "/notifications/test-push", {})).json())
          .delivered,
        1,
      );
      assert.equal(
        (
          await request(base, "/notifications/unsubscribe", {
            endpoint: subscription.endpoint,
          })
        ).status,
        200,
      );
      assert.equal((await store.subscriptions("alice")).length, 0);
    },
  );
});

test("real Stripe signature verification accepts original raw bytes and rejects tampering", async () => {
  const store = fixtures();
  await store.setAccount("alice", { customerId: "cus_alice" });
  const sdk = new Stripe("sk_test_local_signature_fixture");
  const payload = JSON.stringify({
    id: "evt_signed",
    created: Math.floor(Date.now() / 1000),
    type: "customer.subscription.updated",
    data: { object: { id: "sub_signed" } },
  });
  const signature = sdk.webhooks.generateTestHeaderString({
    payload,
    secret: config.stripeWebhookSecret,
  });
  await run(
    {
      store,
      serviceConfig: config,
      stripe: { ...stripe, webhooks: sdk.webhooks },
    },
    async (base) => {
      const send = (body) =>
        fetch(base + "/billing/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": signature,
          },
          body,
        });
      assert.equal((await send(payload + " ")).status, 400);
      assert.equal((await send(payload)).status, 200);
      assert.equal((await store.getAccount("alice")).status, "active");
    },
  );
});
test("account integrations reject local demo authentication", () =>
  run({ store: fixtures(), stripe, serviceConfig: config }, async (base) =>
    assert.equal(
      (await request(base, "/billing/status", undefined, null)).status,
      401,
    ),
  ));
test("Checkout uses server price and account ownership, never a submitted price", () => {
  const store = fixtures();
  let params;
  const sdk = {
    ...stripe,
    checkout: {
      sessions: {
        ...stripe.checkout.sessions,
        create: async (p) => {
          params = p;
          return { id: "cs_test", url: "https://checkout.stripe.com/test" };
        },
      },
    },
  };
  return run({ store, stripe: sdk, serviceConfig: config }, async (base) => {
    const response = await request(base, "/billing/checkout", {
      requestId: "12345678-1234-1234-1234-123456789abc",
      priceId: "attacker",
    });
    assert.equal(response.status, 200);
    assert.equal(params.line_items[0].price, "price_study");
    assert.equal(params.subscription_data.metadata.uid, "alice");
    assert.equal(params.customer, "cus_alice");
  });
});
test("webhook validates raw signature and duplicate events do not duplicate account updates", () => {
  const store = fixtures();
  return run({ store, stripe, serviceConfig: config }, async (base) => {
    await store.setAccount("alice", { customerId: "cus_alice" });
    const event = {
      id: "evt1",
      created: 1,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub1",
          customer: "cus_alice",
          metadata: { uid: "alice" },
        },
      },
    };
    const post = (signature) =>
      fetch(base + "/billing/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": signature,
        },
        body: JSON.stringify(event),
      });
    assert.equal((await post("invalid")).status, 400);
    assert.equal((await post("valid")).status, 200);
    assert.equal((await post("valid")).status, 200);
    assert.equal((await store.getAccount("alice")).status, "active");
  });
});
test("notifications use verified account email and refuse injected recipient", () => {
  const store = fixtures();
  return run(
    { store, stripe, serviceConfig: { ...config, billingRequired: false } },
    async (base) => {
      const response = await request(base, "/notifications/preferences", {
        ...settings,
        email: "victim@example.com",
      });
      assert.equal(response.status, 400);
      const valid = await request(base, "/notifications/preferences", settings);
      assert.equal(valid.status, 200);
      assert.equal(
        (await store.getProfile("alice")).email,
        "alice@example.com",
      );
    },
  );
});
test("push subscription rejects private-network endpoints", () =>
  run({ store: fixtures(), stripe, serviceConfig: config }, async (base) =>
    assert.equal(
      (
        await request(base, "/notifications/subscribe", {
          endpoint: "https://127.0.0.1/push",
          keys: { p256dh: "x", auth: "x" },
        })
      ).status,
      400,
    ),
  ));
test("AI entitlement is enforced on the server when billing is required", () =>
  run(
    {
      store: fixtures(),
      stripe,
      serviceConfig: config,
      generate: async () => "Should not run",
    },
    async (base) =>
      assert.equal(
        (
          await request(base, "/coach/chat", {
            message: "Help",
            context: { subjects: [], sessions: [] },
          })
        ).status,
        402,
      ),
  ));

test("an old canceled subscription cannot replace a newer active subscription", async () => {
  const { processWebhook } = await import("../server/integrations.mjs");
  const store = fixtures();
  await store.setAccount("alice", {
    customerId: "cus_alice",
    subscriptionId: "new",
    status: "active",
    subscriptionCreated: 100,
  });
  await processWebhook(
    {
      id: "late",
      created: 200,
      type: "customer.subscription.deleted",
      data: { object: { id: "old" } },
    },
    {
      store,
      config,
      stripe: {
        ...stripe,
        subscriptions: {
          retrieve: async () => ({
            id: "old",
            created: 50,
            status: "canceled",
            customer: "cus_alice",
            metadata: { uid: "alice" },
            items: { data: [{ price: { id: "price_study" } }] },
          }),
        },
      },
    },
  );
  assert.equal((await store.getAccount("alice")).status, "active");
  assert.equal((await store.getAccount("alice")).subscriptionId, "new");
});

test("email delivery rejects an unverified account", () => {
  const store = fixtures();
  store.user = async () => ({
    email: "alice@example.com",
    emailVerified: false,
  });
  return run(
    { store, stripe, serviceConfig: { ...config, billingRequired: false } },
    async (base) => {
      assert.equal(
        (await request(base, "/notifications/preferences", settings)).status,
        409,
      );
      assert.equal(
        (await request(base, "/notifications/test-email", {})).status,
        409,
      );
    },
  );
});

test("test push removes expired browsers while still delivering to active browsers", async () => {
  const store = fixtures();
  await store.putSubscription("alice", "expired", { endpoint: "expired" });
  await store.putSubscription("alice", "active", { endpoint: "active" });
  const sendPush = async (subscription) => {
    if (subscription.endpoint === "expired")
      throw Object.assign(new Error("Expired"), { statusCode: 410 });
  };
  await run(
    {
      store,
      stripe,
      sendPush,
      serviceConfig: { ...config, billingRequired: false },
    },
    async (base) => {
      const response = await request(base, "/notifications/test-push", {});
      assert.equal(response.status, 200);
      assert.equal((await response.json()).delivered, 1);
      assert.equal((await store.subscriptions("alice")).length, 1);
    },
  );
});

test("configured HTTPS app origin works through a reverse proxy and rejects foreign origins", () =>
  run(
    {
      store: fixtures(),
      stripe,
      serviceConfig: { ...config, appUrl: "https://study.example.com" },
    },
    async (base) => {
      const call = (origin) =>
        fetch(base + "/account/services", {
          headers: { Authorization: "Bearer test", Origin: origin },
        });
      assert.equal((await call("https://study.example.com")).status, 200);
      assert.equal((await call("https://foreign.example.com")).status, 403);
    },
  ));
