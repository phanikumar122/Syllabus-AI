import "dotenv/config";
import {
  getApps,
  initializeApp,
  applicationDefault,
  deleteApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { createECDH } from "node:crypto";
import {
  serviceConfig,
  stripeClient,
  emailTransport,
} from "../server/providers.mjs";

let failed = false;
async function check(name, ready, action) {
  if (!ready) {
    console.log(`${name}: missing configuration`);
    failed = true;
    return;
  }
  try {
    await action();
    console.log(`${name}: verified`);
  } catch {
    console.log(
      `${name}: verification failed; check credentials, permissions, and provider settings`,
    );
    failed = true;
  }
}
const config = serviceConfig();
const webReady = [
  "API_KEY",
  "AUTH_DOMAIN",
  "PROJECT_ID",
  "STORAGE_BUCKET",
  "MESSAGING_SENDER_ID",
  "APP_ID",
].every((key) => process.env[`VITE_FIREBASE_${key}`]);
console.log(
  `Google sign-in: ${webReady ? "web settings present; verify interactive login and authorized domain in browser" : "missing web configuration"}`,
);
if (!webReady) failed = true;
await check(
  "Firebase Admin + Firestore",
  Boolean(process.env.FIREBASE_PROJECT_ID),
  async () => {
    if (
      process.env.VITE_FIREBASE_PROJECT_ID !== process.env.FIREBASE_PROJECT_ID
    )
      throw new Error("Project mismatch");
    const app =
      getApps()[0] ||
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    await getAuth(app).listUsers(1);
    await getFirestore(
      app,
      process.env.VITE_FIREBASE_DATABASE_ID || "(default)",
    )
      .collection("billingAccounts")
      .limit(1)
      .get();
  },
);
await check("Gemini", Boolean(process.env.GEMINI_API_KEY), async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: "Reply OK.",
    config: { maxOutputTokens: 128, abortSignal: AbortSignal.timeout(20000) },
  });
  if (!response.text) throw new Error("Empty response");
});
const stripe = stripeClient();
await check(
  "Stripe recurring price",
  Boolean(stripe && config.stripePriceId && config.stripeWebhookSecret),
  async () => {
    const price = await stripe.prices.retrieve(config.stripePriceId);
    if (
      !price.active ||
      price.type !== "recurring" ||
      !price.recurring ||
      price.unit_amount == null
    )
      throw new Error("Invalid price");
  },
);
await check("SMTP connection", config.smtpReady, async () => {
  const transport = emailTransport();
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
});
await check("Web Push VAPID pair", config.pushReady, async () => {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(process.env.VAPID_PRIVATE_KEY, "base64url"));
  if (ecdh.getPublicKey().toString("base64url") !== config.vapidPublicKey)
    throw new Error("Key mismatch");
  const subject = new URL(process.env.VAPID_SUBJECT);
  if (!["mailto:", "https:"].includes(subject.protocol))
    throw new Error("Invalid contact");
});
console.log(
  `Background scheduler: ${config.workerEnabled ? "enabled on server startup" : "disabled; enable it or schedule notifications:once externally"}`,
);
console.log(
  "This check sends one small Gemini request when configured. It creates no payments and sends no email or push. Verify actual login, workspace sync, signed webhooks, sender delivery, and browser receipt separately.",
);
await Promise.all(getApps().map(deleteApp));
process.exitCode = failed ? 1 : 0;
