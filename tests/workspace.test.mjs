import test from "node:test";
import assert from "node:assert/strict";
import {
  applySessionChange,
  emptyWorkspace,
  decodeWorkspace,
  validateWorkspace,
} from "../src/domain/workspace.ts";

test("legacy light and system workspaces load as dark without changing study data or the input", () => {
  for (const theme of ["light", "system"]) {
    const original = emptyWorkspace();
    original.preferences.theme = theme;
    const decoded = decodeWorkspace(original);
    assert.equal(decoded.preferences.theme, "dark");
    assert.equal(original.preferences.theme, theme);
    assert.deepEqual(decoded.subjects, original.subjects);
    assert.deepEqual(decoded.studyLog, original.studyLog);
  }
});
const topic = {
  id: "t",
  title: "Topic",
  chapter: "Unit",
  priority: "High",
  minutes: 180,
  status: "Not started",
  notes: "",
  revisionStatus: "New",
};
const base = () => ({
  ...emptyWorkspace(),
  subjects: [
    {
      id: "s",
      name: "Subject",
      examDate: "2027-01-01",
      color: "#7357ff",
      difficulty: "Heavy",
      topics: [topic],
    },
  ],
});
const block = {
  id: "b",
  date: "2026-11-15",
  start: "08:00",
  duration: 90,
  subjectId: "s",
  topicId: "t",
  priority: "High",
  status: "completed",
};
test("partial effort stays in progress and undo removes recorded effort", () => {
  const state = applySessionChange(base(), undefined, block);
  assert.equal(state.subjects[0].topics[0].status, "In progress");
  const undone = applySessionChange(state, block, undefined);
  assert.equal(undone.subjects[0].topics[0].status, "Not started");
  assert.equal(undone.studyLog.length, 0);
});
test("editing completed duration recomputes topic completion", () => {
  const old = { ...block, duration: 180 };
  const state = applySessionChange(base(), undefined, old);
  const changed = applySessionChange(state, old, block);
  assert.equal(changed.subjects[0].topics[0].status, "In progress");
  assert.equal(changed.studyLog[0].hours, 1.5);
});
test("invalid persisted state fails closed", () => {
  assert.throws(() =>
    validateWorkspace({
      ...base(),
      preferences: { ...base().preferences, dailyGoal: -1 },
    }),
  );
});
test("invalid learning goal is rejected", () =>
  assert.throws(() =>
    validateWorkspace({
      ...base(),
      preferences: { ...base().preferences, examType: "invalid" },
    }),
  ));
