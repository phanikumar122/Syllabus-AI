import Stripe from "stripe";
import nodemailer from "nodemailer";
import * as webpush from "web-push";
export const serviceConfig = () => ({
  appUrl: process.env.APP_URL || "http://localhost:3000",
  stripePriceId: process.env.STRIPE_PRICE_ID || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  billingRequired: process.env.BILLING_REQUIRED === "true",
  smtpReady: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
  pushReady: Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  ),
  workerEnabled: process.env.NOTIFICATION_WORKER_ENABLED === "true",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
});
export const stripeClient = () =>
  process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        maxNetworkRetries: 2,
        timeout: 20000,
      })
    : null;
export function emailTransport() {
  if (!serviceConfig().smtpReady) return null;
  const port = Number(process.env.SMTP_PORT || 587),
    secure = port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}
export const sendEmail = async ({ to, subject, text, id }) => {
  const transport = emailTransport();
  if (!transport)
    throw Object.assign(new Error("SMTP is not configured."), { status: 503 });
  const result = await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    messageId: `<${id}@${new URL(serviceConfig().appUrl).hostname}>`,
  });
  if (!result.accepted?.length) throw new Error("SMTP recipient rejected");
  return result;
};
export const sendPush = (subscription, payload) => {
  const env = serviceConfig();
  if (!env.pushReady)
    throw Object.assign(new Error("Web Push is not configured."), {
      status: 503,
    });
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT,
      publicKey: env.vapidPublicKey,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    },
    TTL: 300,
    timeout: 15000,
    urgency: "normal",
  });
};
