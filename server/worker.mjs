import "dotenv/config";
import { getApps, deleteApp } from "firebase-admin/app";
import { defaultStore } from "./store.mjs";
import { sendEmail, sendPush, serviceConfig } from "./providers.mjs";
import { runNotifications } from "./notifications.mjs";
export async function tickNotifications() {
  return runNotifications({
    store: defaultStore(),
    sendEmail,
    sendPush,
    config: serviceConfig(),
  });
}
export async function runNotificationJob({
  tick = tickNotifications,
  cleanup = () => Promise.all(getApps().map(deleteApp)),
} = {}) {
  try {
    return await tick();
  } finally {
    await cleanup();
  }
}
export function startNotificationWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await tickNotifications();
      if (result.sent || result.failed)
        console.log("Notification worker:", result);
    } catch {
      console.error(
        "Notification worker could not access its storage. Check server credentials.",
      );
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60000);
  timer.unref();
  return () => clearInterval(timer);
}
