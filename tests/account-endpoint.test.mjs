import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("account requests use the configured Render API and retain Firebase authentication", async () => {
  const { auth } = await import("../src/lib/firebase.ts");
  const originalUser = Object.getOwnPropertyDescriptor(auth, "currentUser");
  const originalFetch = globalThis.fetch;
  const file = new URL("../src/services/accountService.ts", import.meta.url);
  const source = await readFile(file, "utf8");
  const compiled = ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    .outputText.replace(
      '"../lib/firebase"',
      JSON.stringify(new URL("../src/lib/firebase.ts", import.meta.url).href),
    )
    .replaceAll(
      "import.meta.env",
      JSON.stringify({
        VITE_AI_API_URL: "https://study-api.onrender.com/api/",
      }),
    );
  try {
    Object.defineProperty(auth, "currentUser", {
      configurable: true,
      value: { uid: "test", getIdToken: async () => "firebase-test-token" },
    });
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ configured: true }));
    };
    const { accountRequest } = await import(
      "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
    );
    assert.deepEqual(await accountRequest("account/services"), {
      configured: true,
    });
    assert.equal(
      request.url,
      "https://study-api.onrender.com/api/account/services",
    );
    assert.equal(
      request.options.headers.Authorization,
      "Bearer firebase-test-token",
    );
    assert.equal(request.options.method, "GET");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUser) Object.defineProperty(auth, "currentUser", originalUser);
  }
});
