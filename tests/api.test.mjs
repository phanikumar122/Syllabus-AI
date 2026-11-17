import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../server/api.mjs";
async function withApi(options, run) {
  const server = createApi(options).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await run(`http://127.0.0.1:${server.address().port}/api`);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
const post = (base, path, body, token) =>
  fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
  });
test("Firebase-hosted browsers can preflight the API while protected requests still require auth", () => {
  let authCalls = 0;
  const origin = "https://study-project.web.app";
  return withApi(
    {
      serviceConfig: { appUrl: origin },
      authenticate: async () => {
        authCalls++;
        throw new Error("missing token");
      },
    },
    async (base) => {
      const preflight = await fetch(base + "/coach/chat", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      });
      assert.equal(preflight.status, 204);
      assert.equal(authCalls, 0);
      assert.equal(
        preflight.headers.get("access-control-allow-origin"),
        origin,
      );
      assert.match(
        preflight.headers.get("access-control-allow-headers"),
        /Authorization/i,
      );
      assert.match(
        preflight.headers.get("access-control-allow-methods"),
        /POST/,
      );
      assert.match(preflight.headers.get("vary"), /Origin/);
      const unauthorized = await fetch(base + "/coach/chat", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Help" }),
      });
      assert.equal(unauthorized.status, 401);
      assert.equal(
        unauthorized.headers.get("access-control-allow-origin"),
        origin,
      );
      const foreign = await fetch(base + "/coach/chat", {
        method: "OPTIONS",
        headers: { Origin: "https://foreign.example.com" },
      });
      assert.equal(foreign.status, 403);
      assert.equal(foreign.headers.get("access-control-allow-origin"), null);
      const health = await fetch(base + "/health", {
        headers: { Origin: origin },
      });
      assert.equal(health.headers.get("access-control-allow-origin"), origin);
    },
  );
});
test("AI routes refuse unauthenticated requests", () =>
  withApi(
    {
      authenticate: async () => {
        throw new Error("invalid");
      },
    },
    async (base) =>
      assert.equal(
        (
          await post(base, "/syllabus/parse", {
            content: "Hi",
            mimeType: "text/plain",
          })
        ).status,
        401,
      ),
  ));
test("parse validates input and provider output", () =>
  withApi(
    {
      authenticate: async () => "uid",
      generate: async () =>
        JSON.stringify({
          topics: [{ title: "Graphs", difficulty: "Hard", estimatedHours: 2 }],
        }),
    },
    async (base) => {
      assert.equal(
        (
          await post(
            base,
            "/syllabus/parse",
            { content: "Hi", mimeType: "application/x-executable" },
            "token",
          )
        ).status,
        400,
      );
      const response = await post(
        base,
        "/syllabus/parse",
        { content: "Graph syllabus", mimeType: "text/plain" },
        "token",
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).topics[0].title, "Graphs");
    },
  ));
test("invalid AI response produces a safe error", () =>
  withApi(
    {
      authenticate: async () => "uid",
      generate: async () =>
        JSON.stringify({
          topics: [{ title: "Bad", difficulty: "Hard", estimatedHours: -2 }],
        }),
    },
    async (base) => {
      assert.equal(
        (
          await post(
            base,
            "/syllabus/parse",
            { content: "Syllabus", mimeType: "text/plain" },
            "token",
          )
        ).status,
        502,
      );
    },
  ));
test("coach returns actual provider response and validates context", () =>
  withApi(
    {
      authenticate: async () => "uid",
      generate: async () => "Try active recall.",
    },
    async (base) => {
      const response = await post(
        base,
        "/coach/chat",
        {
          message: "Help me learn",
          context: {
            subjects: [],
            sessions: [],
            preferences: { dailyGoal: 2 },
          },
          history: [],
        },
        "token",
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).message, "Try active recall.");
    },
  ));
test("production refuses the localhost development bypass", async () => {
  const previous = {
    node: process.env.NODE_ENV,
    local: process.env.ALLOW_LOCAL_AI,
  };
  process.env.NODE_ENV = "production";
  process.env.ALLOW_LOCAL_AI = "true";
  try {
    await withApi({ generate: async () => "Unused" }, async (base) =>
      assert.equal(
        (
          await post(base, "/coach/chat", {
            message: "Help",
            context: { subjects: [], sessions: [] },
          })
        ).status,
        401,
      ),
    );
  } finally {
    if (previous.node === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.node;
    if (previous.local === undefined) delete process.env.ALLOW_LOCAL_AI;
    else process.env.ALLOW_LOCAL_AI = previous.local;
  }
});
test("coach accepts its own valid long responses in subsequent history", () =>
  withApi(
    {
      authenticate: async () => "uid",
      generate: async () => "Use active recall.",
    },
    async (base) => {
      const response = await post(
        base,
        "/coach/chat",
        {
          message: "Continue",
          context: { subjects: [], sessions: [] },
          history: [{ role: "assistant", text: "a".repeat(9000) }],
        },
        "token",
      );
      assert.equal(response.status, 200);
    },
  ));
