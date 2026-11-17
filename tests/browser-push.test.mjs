import test from "node:test";
import assert from "node:assert/strict";
test("push permission is requested before network work and denial creates no subscription", async () => {
  const { auth } = await import("../src/lib/firebase.ts");
  const { enableBrowserPush } =
    await import("../src/services/accountService.ts");
  const originalUser = Object.getOwnPropertyDescriptor(auth, "currentUser");
  const originals = new Map(
    ["navigator", "window", "Notification", "fetch"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  let requests = 0;
  try {
    Object.defineProperty(auth, "currentUser", {
      configurable: true,
      value: { uid: "test", getIdToken: async () => "test" },
    });
    const notification = { requestPermission: async () => "denied" };
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { serviceWorker: {} },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        PushManager: {},
        Notification: notification,
        isSecureContext: true,
      },
    });
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: notification,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async () => {
        requests++;
        return { ok: true, json: async () => ({ publicKey: "test" }) };
      },
    });
    await assert.rejects(enableBrowserPush(), /permission was not granted/);
    assert.equal(requests, 0);
  } finally {
    if (originalUser) Object.defineProperty(auth, "currentUser", originalUser);
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
