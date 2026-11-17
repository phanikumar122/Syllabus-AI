import express from "express";
import { hash } from "./store.mjs";
const error = (status, message) =>
  Object.assign(new Error(message), { status });
const premium = (status) => ["active", "trialing"].includes(status);
const key = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);
export function validPush(value) {
  if (
    !value ||
    typeof value.endpoint !== "string" ||
    value.endpoint.length > 2048
  )
    throw error(400, "Invalid push subscription.");
  let url;
  try {
    url = new URL(value.endpoint);
  } catch {
    throw error(400, "Invalid push endpoint.");
  }
  const allowed = [
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "web.push.apple.com",
    "wns.windows.com",
    "notify.windows.com",
  ];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !allowed.some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    )
  )
    throw error(400, "Unrecognized browser push service.");
  if (
    !value.keys ||
    typeof value.keys.p256dh !== "string" ||
    typeof value.keys.auth !== "string" ||
    !/^[A-Za-z0-9_-]{87}$/.test(value.keys.p256dh) ||
    !/^[A-Za-z0-9_-]{22}$/.test(value.keys.auth)
  )
    throw error(400, "Invalid push encryption keys.");
  return {
    endpoint: value.endpoint,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  };
}
export function integrationRoutes({
  store,
  stripe,
  config,
  sendEmail,
  sendPush,
}) {
  const router = express.Router();
  const baseUrl = () => {
    const url = new URL(config.appUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    )
      throw error(503, "Configure the public HTTPS APP_URL on the server.");
    return url.origin;
  };
  const billingReady = () =>
    Boolean(stripe && config.stripePriceId && config.stripeWebhookSecret);
  const requireAccount = (req, _res, next) => {
    if (
      !req.headers.authorization?.startsWith("Bearer ") ||
      !req.uid ||
      req.uid === "local-demo"
    )
      return next(error(401, "Sign in to manage billing and notifications."));
    next();
  };
  const entitled = async (req) => {
    if (
      config.billingRequired &&
      !premium((await store.getAccount(req.uid)).status)
    )
      throw error(402, "An active subscription is required for this service.");
  };
  router.use(requireAccount);
  router.get("/account/services", async (req, res) =>
    res.json({
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      billingConfigured: billingReady(),
      emailConfigured: config.smtpReady,
      pushConfigured: config.pushReady,
      workerEnabled: config.workerEnabled,
      billingRequired: config.billingRequired,
    }),
  );
  router.get("/billing/status", async (req, res) => {
    const account = billingReady() ? await store.getAccount(req.uid) : {};
    const price = billingReady()
      ? await stripe.prices.retrieve(config.stripePriceId)
      : null;
    res.json({
      configured: billingReady(),
      status: account.status || "free",
      premium: premium(account.status),
      cancelAtPeriodEnd: Boolean(account.cancelAtPeriodEnd),
      hasCustomer: Boolean(account.customerId),
      price: price
        ? {
            amount: price.unit_amount,
            currency: price.currency,
            interval: price.recurring?.interval,
            intervalCount: price.recurring?.interval_count,
          }
        : null,
    });
  });
  router.post("/billing/checkout", async (req, res) => {
    if (!billingReady()) throw error(503, "Stripe is not configured.");
    if (!key(req.body?.requestId))
      throw error(400, "A valid checkout request ID is required.");
    const lock = `checkout:${req.uid}`;
    if (!(await store.claim(lock, Date.now(), 180000)))
      throw error(409, "Checkout is already being prepared. Please wait.");
    try {
      let account = await store.getAccount(req.uid);
      if (
        premium(account.status) ||
        ["past_due", "unpaid", "paused", "incomplete"].includes(account.status)
      )
        throw error(
          409,
          "Manage your existing subscription in the customer portal.",
        );
      if (account.pendingCheckout) {
        const pending = await stripe.checkout.sessions.retrieve(
          account.pendingCheckout,
        );
        if (pending.status === "open") {
          res.json({ url: pending.url });
          return;
        }
        if (pending.status === "complete")
          throw error(
            409,
            "Payment is being confirmed. Refresh billing status shortly.",
          );
      }
      const price = await stripe.prices.retrieve(config.stripePriceId);
      if (!price.active || price.type !== "recurring")
        throw error(503, "Configure an active recurring Stripe price.");
      const user = await store.user(req.uid);
      if (!account.customerId) {
        const customer = await stripe.customers.create(
          {
            metadata: { uid: req.uid },
            ...(user.emailVerified && user.email ? { email: user.email } : {}),
          },
          { idempotencyKey: `customer:${req.uid}` },
        );
        await store.setAccount(req.uid, { customerId: customer.id });
        account = { ...account, customerId: customer.id };
      }
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: account.customerId,
          line_items: [{ price: config.stripePriceId, quantity: 1 }],
          client_reference_id: req.uid,
          metadata: { uid: req.uid },
          subscription_data: { metadata: { uid: req.uid } },
          success_url: `${baseUrl()}/?checkout=success#settings`,
          cancel_url: `${baseUrl()}/?checkout=cancelled#settings`,
        },
        { idempotencyKey: `checkout:${req.uid}:${req.body.requestId}` },
      );
      await store.setAccount(req.uid, { pendingCheckout: session.id });
      res.json({ url: session.url });
    } finally {
      await store.finish(lock, "released", Date.now());
    }
  });
  router.post("/billing/portal", async (req, res) => {
    if (!billingReady()) throw error(503, "Stripe is not configured.");
    const account = await store.getAccount(req.uid);
    if (!account.customerId) throw error(409, "No billing account exists yet.");
    res.json(
      await stripe.billingPortal.sessions.create({
        customer: account.customerId,
        return_url: `${baseUrl()}/#settings`,
      }),
    );
  });
  router.get("/notifications/preferences", async (req, res) => {
    const value = await store.getProfile(req.uid);
    res.json({
      emailEnabled: Boolean(value.emailEnabled),
      pushEnabled: Boolean(value.pushEnabled),
      digestEnabled: Boolean(value.digestEnabled),
      timeZone: value.timeZone || "UTC",
      leadMinutes: value.leadMinutes || 15,
      email: value.email || "",
      subscriptions: (await store.subscriptions(req.uid)).length,
    });
  });
  router.post("/notifications/preferences", async (req, res) => {
    const body = req.body || {},
      allowed = [
        "emailEnabled",
        "pushEnabled",
        "digestEnabled",
        "timeZone",
        "leadMinutes",
      ];
    if (
      Object.keys(body).some((k) => !allowed.includes(k)) ||
      [body.emailEnabled, body.pushEnabled, body.digestEnabled].some(
        (v) => typeof v !== "boolean",
      ) ||
      !Number.isInteger(body.leadMinutes) ||
      body.leadMinutes < 5 ||
      body.leadMinutes > 60
    )
      throw error(400, "Choose valid notification preferences.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: body.timeZone }).format();
    } catch {
      throw error(400, "Choose a valid IANA time zone.");
    }
    if (typeof body.timeZone !== "string" || body.timeZone.length > 100)
      throw error(400, "Invalid time zone.");
    if (body.emailEnabled || body.digestEnabled) {
      if (!config.smtpReady)
        throw error(503, "Email delivery is not configured.");
      await entitled(req);
    }
    if (body.pushEnabled) {
      if (!config.pushReady) throw error(503, "Web Push is not configured.");
      await entitled(req);
    }
    const user = await store.user(req.uid);
    if (
      (body.emailEnabled || body.digestEnabled) &&
      (!user.emailVerified || !user.email)
    )
      throw error(409, "Verify your account email before enabling delivery.");
    await store.setProfile(req.uid, {
      uid: req.uid,
      email: user.emailVerified ? user.email || "" : "",
      emailEnabled: body.emailEnabled,
      pushEnabled: body.pushEnabled,
      digestEnabled: body.digestEnabled,
      timeZone: body.timeZone,
      leadMinutes: body.leadMinutes,
      enabled: body.emailEnabled || body.pushEnabled || body.digestEnabled,
    });
    res.json({ saved: true });
  });
  router.get("/notifications/push-key", (_req, res) =>
    res.json({ publicKey: config.pushReady ? config.vapidPublicKey : null }),
  );
  router.post("/notifications/subscribe", async (req, res) => {
    const value = validPush(req.body);
    if (!config.pushReady) throw error(503, "Web Push is not configured.");
    await entitled(req);
    const list = await store.subscriptions(req.uid),
      id = hash(value.endpoint);
    if (list.length >= 10 && !list.some((v) => v.id === id))
      throw error(
        409,
        "Remove an old browser subscription before adding another.",
      );
    await store.putSubscription(req.uid, id, value);
    res.json({ id });
  });
  router.post("/notifications/unsubscribe", async (req, res) => {
    if (
      typeof req.body?.endpoint !== "string" ||
      req.body.endpoint.length > 2048
    )
      throw error(400, "Invalid endpoint.");
    await store.removeSubscription(req.uid, hash(req.body.endpoint));
    res.json({ removed: true });
  });
  router.post("/notifications/test-email", async (req, res) => {
    await entitled(req);
    const user = await store.user(req.uid);
    if (!user.emailVerified || !user.email)
      throw error(409, "Verify your account email first.");
    await sendEmail({
      to: user.email,
      subject: "Syllabus AI email delivery test",
      text: `Email delivery is connected. Manage preferences at ${baseUrl()}/#settings`,
      id: hash(`${req.uid}:${Date.now()}`),
    });
    res.json({ accepted: true });
  });
  router.post("/notifications/test-push", async (req, res) => {
    await entitled(req);
    const subscriptions = await store.subscriptions(req.uid);
    if (!subscriptions.length)
      throw error(409, "Enable notifications on this browser first.");
    const results = await Promise.all(
      subscriptions.map(async (s) => {
        try {
          if (
            store.ownsSubscription &&
            !(await store.ownsSubscription(req.uid, s.id))
          )
            return "expired";
          await sendPush(s.subscription, {
            title: "Syllabus AI",
            body: "Background notifications are connected.",
            url: "/\u0023planner",
            tag: "syllabus-ai-test",
          });
          return "delivered";
        } catch (e) {
          if ([404, 410].includes(e.statusCode)) {
            await store.removeSubscription(req.uid, s.id);
            return "expired";
          }
          return "failed";
        }
      }),
    );
    const delivered = results.filter((result) => result === "delivered").length;
    if (!delivered)
      throw error(
        502,
        "No browser accepted the test push. Enable this browser again or check the push configuration.",
      );
    res.json({
      accepted: true,
      delivered,
      failed: results.filter((result) => result === "failed").length,
      expired: results.filter((result) => result === "expired").length,
    });
  });
  return router;
}
export async function processWebhook(event, { store, stripe, config }) {
  if (
    ![
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ].includes(event.type)
  )
    return;
  const object = event.data.object;
  const subscriptionId = event.type.startsWith("customer.subscription.")
    ? object.id
    : object.subscription || object.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(
    typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id,
  );
  const uid = sub.metadata?.uid;
  if (!key(uid)) throw error(400, "Subscription has no valid account owner.");
  const account = await store.getAccount(uid),
    customer =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (account.customerId !== customer)
    throw error(400, "Subscription customer does not match its account.");
  const matches = sub.items.data.some(
    (item) => item.price.id === config.stripePriceId,
  );
  const status = matches ? sub.status : "unsupported";
  if (
    account.subscriptionId &&
    account.subscriptionId !== sub.id &&
    ((sub.created || 0) < (account.subscriptionCreated || 0) ||
      (!premium(status) && premium(account.status)))
  )
    return;
  await store.applySubscription(
    event.id,
    uid,
    {
      subscriptionId: sub.id,
      subscriptionCreated: sub.created || 0,
      status,
      cancelAtPeriodEnd: sub.cancel_at_period_end || false,
      pendingCheckout: null,
    },
    event.created,
  );
}
