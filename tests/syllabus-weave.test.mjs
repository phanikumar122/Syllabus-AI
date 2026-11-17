import test from "node:test";
import assert from "node:assert/strict";
import { createWeaveData, weavePoint } from "../src/visuals/weaveGeometry.ts";

test("custom weave has finite, bounded vertices and valid nondegenerate faces", () => {
  for (const phase of [0, 0.7, 5]) {
    for (let strand = 0; strand < 5; strand++) {
      const { positions, indices } = createWeaveData(strand, phase);
      assert.equal(positions.length, 121 * 7 * 3);
      assert.equal(indices.length, 120 * 6 * 6);
      assert.ok(
        [...positions].every((v) => Number.isFinite(v) && Math.abs(v) < 4),
      );
      for (let i = 0; i < indices.length; i += 3) {
        const vertices = Array.from(indices.slice(i, i + 3), (index) => {
          assert.ok(index < positions.length / 3);
          return Array.from(positions.slice(index * 3, index * 3 + 3));
        });
        const ab = vertices[1].map((v, j) => v - vertices[0][j]);
        const ac = vertices[2].map((v, j) => v - vertices[0][j]);
        const cross = [
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ];
        assert.ok(Math.hypot(...cross) > 1e-7);
      }
    }
  }
});

test("weave unfolds over time while keeping its open ends and distinct strands", () => {
  assert.notDeepEqual(weavePoint(0.35, 0, 0, 0), weavePoint(0.35, 0, 0, 1));
  assert.notDeepEqual(weavePoint(0.35, 0, 0, 0), weavePoint(0.35, 0, 1, 0));
  assert.ok(weavePoint(1, 0, 0, 0)[1] - weavePoint(0, 0, 0, 0)[1] > 3);
});
