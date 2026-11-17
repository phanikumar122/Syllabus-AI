import test from "node:test";
import assert from "node:assert/strict";
import { generateStudyPlan } from "../src/services/plannerService.ts";
test("legacy planner splits a long topic without wasting its only day", () => {
  const plan = generateStudyPlan(
    [{ id: "t", title: "Long", difficulty: "Hard", estimatedHours: 3 }],
    new Date("2026-11-16T12:00:00"),
    3,
    new Date("2026-11-15T07:00:00"),
  );
  assert.equal(
    plan[0]?.allocations?.reduce((n, a) => n + a.minutes, 0),
    180,
  );
});
test("legacy planner reports infeasible workload", () =>
  assert.throws(
    () =>
      generateStudyPlan(
        [{ id: "t", title: "Long", difficulty: "Hard", estimatedHours: 20 }],
        new Date("2026-11-16T12:00:00"),
        2,
        new Date("2026-11-15T07:00:00"),
      ),
    /fit/,
  ));
