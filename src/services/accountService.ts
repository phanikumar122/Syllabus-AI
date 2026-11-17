import { auth } from "../lib/firebase";
const endpoint = import.meta.env?.VITE_AI_API_URL?.trim() || "/api";
export interface Services {
  aiConfigured: boolean;
  billingConfigured: boolean;
  emailConfigured: boolean;
  pushConfigured: boolean;
  workerEnabled: boolean;
  billingRequired: boolean;
}
export interface BillingStatus {
  configured: boolean;
  status: string;
  premium: boolean;
  hasCustomer: boolean;
  cancelAtPeriodEnd: boolean;
  price: {
    amount: number | null;
    currency: string;
    interval: string;
    intervalCount?: number;
  } | null;
}
export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestEnabled: boolean;
  timeZone: string;
  leadMinutes: number;
  email?: string;
  subscriptions?: number;
}
export async function accountRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to configure account services.");
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const value = await response.json().catch(() => {
    throw new Error("The account server is unavailable.");
  });
  if (!response.ok) throw new Error(value.error || "Account request failed.");
  return value;
}
const pushSupported = () =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window &&
  window.isSecureContext;
export async function enableBrowserPush() {
  if (!pushSupported())
    throw new Error(
      "This browser needs Web Push support and HTTPS (or localhost).",
    );
  if (!auth.currentUser)
    throw new Error("Sign in to enable browser notifications.");
  // Keep the permission request in the user's click gesture, before network awaits.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Notification permission was not granted. You can change it in browser settings.",
    );
  const { publicKey } = await accountRequest<{ publicKey: string | null }>(
    "notifications/push-key",
  );
  if (!publicKey) throw new Error("Web Push is not configured on the server.");
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }));
  try {
    await accountRequest("notifications/subscribe", subscription.toJSON());
  } catch (e) {
    await subscription.unsubscribe();
    throw e;
  }
  localStorage.setItem("syllabus-ai-push-owner", auth.currentUser!.uid);
  return subscription;
}
export async function disableBrowserPush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await accountRequest("notifications/unsubscribe", {
      endpoint: subscription.endpoint,
    });
    await subscription.unsubscribe();
  }
  localStorage.removeItem("syllabus-ai-push-owner");
}
export async function clearForeignBrowserPush(uid: string) {
  if (!pushSupported()) return;
  const owner = localStorage.getItem("syllabus-ai-push-owner");
  if (owner && owner !== uid) {
    const registration =
      await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
    localStorage.removeItem("syllabus-ai-push-owner");
  }
}
export function checkoutRedirect(url: string, kind: "checkout" | "portal") {
  const parsed = new URL(url);
  const allowed =
    kind === "checkout" ? "checkout.stripe.com" : "billing.stripe.com";
  if (parsed.protocol !== "https:" || parsed.hostname !== allowed)
    throw new Error("Invalid Stripe redirect.");
  window.location.assign(parsed.href);
}
