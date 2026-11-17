import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { readFile } from "node:fs/promises";
test("service worker displays push content and limits click navigation to its own origin", async () => {
  const source = await readFile("public/sw.js", "utf8"),
    handlers = {};
  let shown, opened;
  const self = {
    location: { origin: "https://study.example" },
    addEventListener: (name, fn) => (handlers[name] = fn),
    registration: {
      showNotification: async (title, options) => {
        shown = { title, options };
      },
    },
    clients: {
      claim: async () => {},
      matchAll: async () => [],
      openWindow: async (url) => {
        opened = url;
      },
    },
    skipWaiting: async () => {},
  };
  runInNewContext(source, { self, URL });
  let task;
  handlers.push({
    data: {
      json: () => ({
        title: "Study",
        body: "Motion",
        url: "https://evil.example",
      }),
    },
    waitUntil: (p) => (task = p),
  });
  await task;
  assert.equal(shown.title, "Study");
  handlers.notificationclick({
    notification: { data: shown.options.data, close: () => {} },
    waitUntil: (p) => (task = p),
  });
  await task;
  assert.equal(opened, "https://study.example/#planner");
});
