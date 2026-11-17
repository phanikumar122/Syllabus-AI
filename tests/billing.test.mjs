import test from "node:test";
import assert from "node:assert/strict";
test("Stripe amounts handle zero-decimal currencies and legacy ISK/UGX units", async () => {
  const { stripeMajorAmount } = await import("../src/domain/billing.ts");
  assert.equal(stripeMajorAmount(900, "usd"), 9);
  assert.equal(stripeMajorAmount(900, "jpy"), 900);
  assert.equal(stripeMajorAmount(500, "isk"), 5);
  assert.equal(stripeMajorAmount(500, "ugx"), 5);
  assert.equal(stripeMajorAmount(1045, "huf"), 10.45);
});
