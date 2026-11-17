self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
function notificationUrl(value) {
  let url;
  try {
    url = new URL(value || "/#planner", self.location.origin);
  } catch {
    url = new URL("/#planner", self.location.origin);
  }
  if (url.origin !== self.location.origin)
    url = new URL("/#planner", self.location.origin);
  return url.href;
}
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { body: "A study session is coming up." };
  }
  event.waitUntil(
    self.registration.showNotification(
      typeof data.title === "string" ? data.title : "Syllabus AI",
      {
        body:
          typeof data.body === "string" ? data.body : "Open your study plan.",
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: typeof data.tag === "string" ? data.tag : "syllabus-ai",
        data: { url: notificationUrl(data.url) },
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = notificationUrl(event.notification.data?.url);
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if (
          new URL(client.url).origin === self.location.origin &&
          "focus" in client
        ) {
          await client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
