import type { Preferences, StudySession, Subject } from "../types";
import {
  addDateDays,
  todayKey,
  validatePreferences,
  validateSubject,
  makeId,
} from "./workspace";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weight = { High: 3, Medium: 2, Low: 1 };
export function buildPlan(
  subjects: Subject[],
  preferences: Preferences,
  existing: StudySession[] = [],
  now = new Date(),
) {
  validatePreferences(preferences);
  subjects.forEach(validateSubject);
  const start =
    { Morning: 480, Afternoon: 840, Evening: 1080, "Late night": 1260 }[
      preferences.preferredTime
    ] ?? 1080;
  const daily = Math.round(preferences.dailyGoal * 60);
  const occupied = new Map<string, number>();
  const nextSlot = new Map<string, number>();
  for (const s of existing.filter((s) => s.status === "completed")) {
    occupied.set(s.date, (occupied.get(s.date) ?? 0) + s.duration);
    const [h, m] = s.start.split(":").map(Number);
    nextSlot.set(
      s.date,
      Math.max(nextSlot.get(s.date) ?? 0, h * 60 + m + s.duration + 5),
    );
  }
  const sessions: StudySession[] = [];
  const unscheduled: { subjectId: string; topicId: string; minutes: number }[] =
    [];
  const work = subjects
    .flatMap((subject) =>
      subject.topics
        .filter((t) => t.status !== "Complete")
        .map((topic) => ({ subject, topic })),
    )
    .sort(
      (a, b) =>
        a.subject.examDate.localeCompare(b.subject.examDate) ||
        weight[b.topic.priority] - weight[a.topic.priority],
    );
  for (const { subject, topic } of work) {
    let remaining = Math.max(
      0,
      topic.minutes -
        existing
          .filter(
            (s) =>
              s.subjectId === subject.id &&
              s.topicId === topic.id &&
              s.status === "completed",
          )
          .reduce((n, s) => n + s.duration, 0),
    );
    let date = todayKey(now),
      scanned = 0;
    while (remaining > 0 && date < subject.examDate && scanned++ < 730) {
      const d = new Date(`${date}T12:00:00`);
      if (preferences.studyDays.includes(days[d.getDay()])) {
        let used = occupied.get(date) ?? 0;
        const earliest =
          date === todayKey(now)
            ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 5) * 5
            : start;
        let slot = Math.max(start, earliest, nextSlot.get(date) ?? 0);
        while (
          remaining > 0 &&
          used < daily &&
          slot < 1440 &&
          sessions.length < 5000
        ) {
          let duration = Math.min(remaining, daily - used, 90, 1440 - slot);
          const tail = remaining - duration;
          if (tail > 0 && tail < 5) duration -= 5 - tail;
          if (duration < 5) break;
          sessions.push({
            id: makeId(),
            date,
            start: `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`,
            duration,
            subjectId: subject.id,
            topicId: topic.id,
            priority: topic.priority,
            status: "planned",
          });
          used += duration;
          remaining -= duration;
          slot += duration + 5;
        }
        // Account for breaks when positioning the next topic, but not in the study-hour budget.
        occupied.set(date, used);
        nextSlot.set(date, slot);
      }
      date = addDateDays(date, 1);
    }
    if (remaining > 0)
      unscheduled.push({
        subjectId: subject.id,
        topicId: topic.id,
        minutes: remaining,
      });
  }
  return { sessions, unscheduled };
}
export const buildSessions = (subjects: Subject[], preferences: Preferences) =>
  buildPlan(subjects, preferences).sessions;
