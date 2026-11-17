import type {
  DemoState,
  Preferences,
  StudySession,
  Subject,
  Topic,
} from "../types";

export const defaultPreferences: Preferences = {
  dailyGoal: 2.5,
  studyDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  preferredTime: "Evening",
  notifications: false,
  weeklyDigest: false,
  theme: "dark",
  examType: "semester",
};
export const emptyWorkspace = (): DemoState => ({
  subjects: [],
  sessions: [],
  studyLog: [],
  preferences: {
    ...defaultPreferences,
    studyDays: [...defaultPreferences.studyDays],
  },
  onboardingComplete: false,
});
export const todayKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
export const addDateDays = (value: string, days: number) => {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayKey(d);
};
export const makeId = () => crypto.randomUUID();
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T12:00:00`);
  return Number.isFinite(d.getTime()) && todayKey(d) === value;
}
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number, min = 0): v is string =>
  typeof v === "string" && v.trim().length >= min && v.length <= max;
const number = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const id = (v: unknown): v is string => text(v, 160, 1) && !v.includes("/");
export function validatePreferences(v: unknown): asserts v is Preferences {
  if (
    record(v) &&
    v.examType !== undefined &&
    !["semester", "competitive", "personal", "other"].includes(
      String(v.examType),
    )
  )
    throw new Error("Choose a valid learning goal.");
  if (
    !record(v) ||
    !number(v.dailyGoal, 0.5, 12) ||
    !Array.isArray(v.studyDays) ||
    v.studyDays.length === 0 ||
    v.studyDays.length > 7 ||
    new Set(v.studyDays).size !== v.studyDays.length ||
    v.studyDays.some(
      (d) =>
        !["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].includes(String(d)),
    ) ||
    !["Morning", "Afternoon", "Evening", "Late night"].includes(
      String(v.preferredTime),
    ) ||
    !["light", "dark", "system"].includes(String(v.theme)) ||
    typeof v.notifications !== "boolean" ||
    typeof v.weeklyDigest !== "boolean"
  )
    throw new Error(
      "Choose 0.5–12 study hours, at least one study day, and valid preferences.",
    );
}
export function validateTopic(v: unknown): asserts v is Topic {
  if (record(v) && !Number.isInteger(v.minutes))
    throw new Error("Topic effort must be a whole number of minutes.");
  if (
    !record(v) ||
    !id(v.id) ||
    !text(v.title, 200, 1) ||
    !text(v.chapter, 160, 1) ||
    !text(v.notes, 4000) ||
    !number(v.minutes, 10, 1440) ||
    !["High", "Medium", "Low"].includes(String(v.priority)) ||
    !["Not started", "In progress", "Complete"].includes(String(v.status)) ||
    !["New", "Review", "Ready"].includes(String(v.revisionStatus))
  )
    throw new Error(
      "Topic needs a title, chapter, 10–1440 minutes, and notes under 4000 characters.",
    );
}
export function validateSubject(v: unknown): asserts v is Subject {
  if (
    !record(v) ||
    !id(v.id) ||
    !text(v.name, 160, 1) ||
    !validDate(v.examDate) ||
    !/^#[a-f\d]{6}$/i.test(String(v.color)) ||
    !["Light", "Medium", "Heavy"].includes(String(v.difficulty)) ||
    !Array.isArray(v.topics) ||
    v.topics.length > 200
  )
    throw new Error(
      "Subject needs a valid name, exam date, color, and up to 200 topics.",
    );
  v.topics.forEach(validateTopic);
  if (new Set(v.topics.map((t) => (t as Topic).id)).size !== v.topics.length)
    throw new Error("Topic IDs must be unique.");
}
export function validateSession(
  v: unknown,
  subjects: Subject[],
  allowArchived = false,
): asserts v is StudySession {
  if (record(v) && !Number.isInteger(v.duration))
    throw new Error("Session duration must be a whole number of minutes.");
  if (
    !record(v) ||
    !id(v.id) ||
    !validDate(v.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v.start)) ||
    !number(v.duration, 5, 720) ||
    !id(v.subjectId) ||
    !id(v.topicId) ||
    !["High", "Medium", "Low"].includes(String(v.priority)) ||
    !["planned", "completed", "missed"].includes(String(v.status)) ||
    (v.note !== undefined && !text(v.note, 2000))
  )
    throw new Error(
      "Session needs a date, start time, and 5–720 positive minutes.",
    );
  const [h, m] = String(v.start).split(":").map(Number);
  if (h * 60 + m + (v.duration as number) > 1440)
    throw new Error("A study session must finish before midnight.");
  if (
    !allowArchived &&
    !subjects.some(
      (s) => s.id === v.subjectId && s.topics.some((t) => t.id === v.topicId),
    )
  )
    throw new Error("Choose a topic belonging to the selected subject.");
}
export function validateWorkspace(v: unknown): asserts v is DemoState {
  if (
    !record(v) ||
    !Array.isArray(v.subjects) ||
    !Array.isArray(v.sessions) ||
    !Array.isArray(v.studyLog) ||
    v.subjects.length > 40 ||
    v.sessions.length > 5000 ||
    v.studyLog.length > 3650 ||
    typeof v.onboardingComplete !== "boolean"
  )
    throw new Error(
      "Workspace is invalid or too large. Export and archive older records.",
    );
  v.subjects.forEach(validateSubject);
  validatePreferences(v.preferences);
  const subjects = v.subjects as Subject[];
  v.sessions.forEach((s) =>
    validateSession(s, subjects, record(s) && s.status === "completed"),
  );
  if (
    new Set(subjects.map((s) => s.id)).size !== subjects.length ||
    new Set(v.sessions.map((s) => (s as StudySession).id)).size !==
      v.sessions.length
  )
    throw new Error("Workspace contains duplicate IDs.");
  if (
    v.studyLog.some(
      (l) =>
        !record(l) ||
        !validDate(l.date) ||
        !number(l.hours, 0, 24) ||
        !number(l.topics, 0, 10000),
    )
  )
    throw new Error("Study history contains invalid entries.");
  if (new TextEncoder().encode(JSON.stringify(v)).length > 8_000_000)
    throw new Error(
      "Workspace exceeds 8 MB. Export and archive older data first.",
    );
}
export function decodeWorkspace(v: unknown): DemoState {
  validateWorkspace(v);
  const state = structuredClone(v);
  state.preferences.theme = "dark";
  return state;
}
export function sessionsOverlap(a: StudySession, b: StudySession) {
  const mins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return (
    a.id !== b.id &&
    a.date === b.date &&
    a.status === "planned" &&
    b.status === "planned" &&
    mins(a.start) < mins(b.start) + b.duration &&
    mins(b.start) < mins(a.start) + a.duration
  );
}
export function applySessionChange(
  state: DemoState,
  previous: StudySession | undefined,
  next: StudySession | undefined,
): DemoState {
  const sessions = next
    ? previous
      ? state.sessions.map((s) => (s.id === previous.id ? next : s))
      : [...state.sessions, next]
    : state.sessions.filter((s) => s.id !== previous?.id);
  const logs = new Map(state.studyLog.map((l) => [l.date, { ...l }]));
  for (const [s, sign] of [
    [previous, -1],
    [next, 1],
  ] as const)
    if (s?.status === "completed") {
      const l = logs.get(s.date) ?? { date: s.date, hours: 0, topics: 0 };
      l.hours = Math.max(
        0,
        Math.round((l.hours + (sign * s.duration) / 60) * 1000) / 1000,
      );
      l.topics = Math.max(0, l.topics + sign);
      logs.set(s.date, l);
    }
  let subjects = state.subjects;
  if (previous?.status === "completed" || next?.status === "completed")
    subjects = subjects.map((subject) => ({
      ...subject,
      topics: subject.topics.map((topic) => {
        if (
          ![previous, next].some(
            (s) => s && s.topicId === topic.id && s.subjectId === subject.id,
          )
        )
          return topic;
        const done = sessions
          .filter(
            (s) =>
              s.subjectId === subject.id &&
              s.topicId === topic.id &&
              s.status === "completed",
          )
          .reduce((n, s) => n + s.duration, 0);
        const status =
          done >= topic.minutes
            ? "Complete"
            : done > 0
              ? "In progress"
              : "Not started";
        return {
          ...topic,
          status,
          revisionStatus:
            status === "Complete"
              ? "Ready"
              : status === "In progress"
                ? "Review"
                : "New",
        } as Topic;
      }),
    }));
  return {
    ...state,
    subjects,
    sessions,
    studyLog: [...logs.values()]
      .filter((l) => l.hours > 0)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
