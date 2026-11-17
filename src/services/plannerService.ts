import { buildPlan } from "../domain/planning";
import { defaultPreferences, todayKey } from "../domain/workspace";
import type { Subject } from "../types";
export interface Topic {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estimatedHours: number;
}
export interface DayPlan {
  date: string;
  topics: string[];
  isRevision: boolean;
  allocations?: { topicId: string; minutes: number }[];
}
export function generateStudyPlan(
  topics: Topic[],
  examDate: Date,
  dailyHours: number,
  startDate = new Date(),
): DayPlan[] {
  const subject: Subject = {
    id: "legacy",
    name: "Imported course",
    color: "#7357ff",
    difficulty: "Medium",
    examDate: todayKey(examDate),
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      chapter: "Imported",
      minutes: Math.round(t.estimatedHours * 60),
      priority:
        t.difficulty === "Hard"
          ? "High"
          : t.difficulty === "Easy"
            ? "Low"
            : "Medium",
      status: "Not started",
      revisionStatus: "New",
      notes: "",
    })),
  };
  const plan = buildPlan(
    [subject],
    {
      ...defaultPreferences,
      dailyGoal: dailyHours,
      preferredTime: "Morning",
      studyDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    [],
    startDate,
  );
  if (plan.unscheduled.length)
    throw new Error(
      "The workload does not fit before the exam. Increase available hours or adjust the deadline.",
    );
  const days = new Map<string, DayPlan>();
  for (const s of plan.sessions) {
    const day = days.get(s.date) ?? {
      date: s.date,
      topics: [],
      isRevision: false,
      allocations: [],
    };
    if (!day.topics.includes(s.topicId)) day.topics.push(s.topicId);
    day.allocations!.push({ topicId: s.topicId, minutes: s.duration });
    days.set(s.date, day);
  }
  return [...days.values()];
}
