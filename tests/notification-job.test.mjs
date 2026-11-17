import { test } from "node:test";
import assert from "node:assert/strict";
import * as worker from "../server/worker.mjs";

test("one-shot notification job awaits cleanup after delivery completes", async () => {
  assert.equal(typeof worker.runNotificationJob, "function");
  const events = [];
  const result = await worker.runNotificationJob({
    tick: async () => {
      events.push("delivered");
      return { sent: 1 };
    },
    cleanup: async () => {
      await new Promise((resolve) => setImmediate(resolve));
      events.push("closed");
    },
  });
  assert.deepEqual(result, { sent: 1 });
  assert.deepEqual(events, ["delivered", "closed"]);
});

test("one-shot notification job closes resources and propagates delivery failure", async () => {
  assert.equal(typeof worker.runNotificationJob, "function");
  const failure = new Error("storage unavailable");
  let closed = false;
  await assert.rejects(
    worker.runNotificationJob({
      tick: async () => {
        throw failure;
      },
      cleanup: async () => {
        closed = true;
      },
    }),
    (error) => error === failure,
  );
  assert.equal(closed, true);
});
