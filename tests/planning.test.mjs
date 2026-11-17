import test from "node:test";
import assert from "node:assert/strict";
import { buildPlan } from "../src/domain/planning.ts";
const now = new Date();
now.setHours(7, 0, 0, 0);
const context = {
  buildSessions: (subjects, prefs) =>
    buildPlan(subjects, prefs, [], now).sessions,
};
const prefs = {
  dailyGoal: 3,
  studyDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  preferredTime: "Evening",
  theme: "dark",
  notifications: false,
  weeklyDigest: false,
};
const deadline = new Date();
deadline.setDate(deadline.getDate() + 1);
const date = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, "0")}-${String(deadline.getDate()).padStart(2, "0")}`;
const topic = (id, minutes) => ({
  id,
  title: id,
  chapter: "Unit",
  priority: "High",
  minutes,
  status: "Not started",
  notes: "",
  revisionStatus: "New",
});
const subject = (topics) => ({
  id: "s",
  name: "Course",
  color: "#7357ff",
  examDate: date,
  difficulty: "Heavy",
  topics,
});
test("generated sessions use distinct nonoverlapping starts on the same day", () => {
  const sessions = context.buildSessions(
    [subject([topic("a", 45), topic("b", 45)])],
    prefs,
  );
  assert.equal(sessions.length, 2);
  assert.notEqual(sessions[0].start, sessions[1].start);
});
test("a long topic uses available daily capacity before its exam", () => {
  const sessions = context.buildSessions(
    [subject([topic("long", 180)])],
    prefs,
  );
  assert.equal(
    sessions.reduce((sum, s) => sum + s.duration, 0),
    180,
  );
});
test("late-night preference schedules after 9pm", () => {
  const sessions = context.buildSessions([subject([topic("a", 30)])], {
    ...prefs,
    preferredTime: "Late night",
  });
  assert.ok(sessions[0].start >= "21:00");
});
test("exact daily capacity is available across separate topics", () => {
  const result = buildPlan(
    [subject([topic("a", 90), topic("b", 90)])],
    prefs,
    [],
    now,
  );
  assert.equal(
    result.sessions.reduce((n, s) => n + s.duration, 0),
    180,
  );
  assert.deepEqual(result.unscheduled, []);
});
test("completed effort is preserved and not planned twice", () => {
  const s = subject([topic("a", 180)]);
  const completed = {
    id: "done",
    date: date.replace(/.$/, "0"),
    start: "08:00",
    duration: 90,
    subjectId: "s",
    topicId: "a",
    priority: "High",
    status: "completed",
  };
  const result = buildPlan([s], prefs, [completed], now);
  assert.equal(
    result.sessions.reduce((n, v) => n + v.duration, 0),
    90,
  );
});
test("planner reports minutes that cannot fit before deadline", () => {
  const result = buildPlan([subject([topic("a", 240)])], prefs, [], now);
  assert.equal(result.unscheduled[0].minutes, 60);
});
test("generated identifiers fit storage validation even for long subject IDs", () => {
  const value = subject([topic("t".repeat(150), 30)]);
  value.id = "s".repeat(150);
  const plan = buildPlan([value], prefs, [], now);
  assert.ok(plan.sessions.every((s) => s.id.length <= 160));
});
test("tiny remainders are allocated as valid blocks instead of dropped forever", () => {
  const value = subject([topic("a", 94)]);
  const twoDays = new Date(now);
  twoDays.setDate(twoDays.getDate() + 2);
  value.examDate = `${twoDays.getFullYear()}-${String(twoDays.getMonth() + 1).padStart(2, "0")}-${String(twoDays.getDate()).padStart(2, "0")}`;
  const plan = buildPlan([value], { ...prefs, dailyGoal: 1.5 }, [], now);
  assert.equal(
    plan.sessions.reduce((n, s) => n + s.duration, 0),
    94,
  );
  assert.ok(plan.sessions.every((s) => s.duration >= 5));
});
