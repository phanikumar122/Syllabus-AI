import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("service setup preserves credentials and reuses generated VAPID keys", async () => {
  const { setupServices } = await import("../scripts/setup-services.mjs");
  const root = await mkdtemp(path.join(tmpdir(), "syllabus-setup-"));
  try {
    await writeFile(
      path.join(root, ".env.example"),
      "SMTP_PASSWORD=\nVAPID_PUBLIC_KEY=\nVAPID_PRIVATE_KEY=\n",
    );
    await writeFile(
      path.join(root, ".env"),
      'SMTP_PASSWORD="existing-secret"\n',
    );
    await setupServices(root);
    const first = await readFile(path.join(root, ".env"), "utf8");
    assert.match(first, /SMTP_PASSWORD="existing-secret"/);
    assert.match(first, /VAPID_PUBLIC_KEY=[A-Za-z0-9_-]{87}/);
    assert.match(first, /VAPID_PRIVATE_KEY=[A-Za-z0-9_-]{43}/);
    await setupServices(root);
    assert.equal(await readFile(path.join(root, ".env"), "utf8"), first);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
