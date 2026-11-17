import { useEffect, useRef, useState } from "react";

import type { DemoActions } from "../hooks/useDemoState";
import type { Preferences, Subject, Topic } from "../types";
import {
  addDateDays,
  defaultPreferences,
  makeId,
  todayKey,
  validateSubject,
  validatePreferences,
} from "../domain/workspace";
import { buildPlan } from "../domain/planning";
import { parseFile, parseSyllabus } from "../services/geminiService";
const blank = (): Subject => ({
  id: makeId(),
  name: "",
  examDate: addDateDays(todayKey(), 30),
  difficulty: "Medium",
  color: "#27fb6b",
  topics: [],
});
export default function Onboarding({
  actions,
  onComplete,
  onExit,
}: {
  actions: DemoActions;
  onComplete: () => void;
  onExit: () => void;
}) {
  const [step, setStep] = useState(0),
    [subjects, setSubjects] = useState<Subject[]>([blank()]),
    [prefs, setPrefs] = useState<Preferences>({ ...defaultPreferences }),
    [texts, setTexts] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [preview, setPreview] = useState<ReturnType<typeof buildPlan> | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const patch = (id: string, value: Partial<Subject>) =>
    setSubjects((current) =>
      current.map((s) => (s.id === id ? { ...s, ...value } : s)),
    );
  const importAI = async (subject: Subject, file?: File) => {
    setBusy(subject.id);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const extracted = file
        ? await parseFile(file, controller.signal)
        : await parseSyllabus(
            texts[subject.id] || "",
            "text/plain",
            controller.signal,
          );
      if (controller.signal.aborted) return;
      patch(subject.id, {
        topics: extracted.map(
          (t) =>
            ({
              id: makeId(),
              title: t.title,
              chapter: t.subject || "Imported syllabus",
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
            }) as Topic,
        ),
      });
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (abort.current === controller) setBusy(null);
    }
  };
  const manual = (subject: Subject) => {
    try {
      const topics = (texts[subject.id] || "")
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean)
        .map(
          (title) =>
            ({
              id: makeId(),
              title,
              chapter: "Manual syllabus",
              minutes: 45,
              priority: "Medium",
              status: "Not started",
              notes: "",
              revisionStatus: "New",
            }) as Topic,
        );
      const next = { ...subject, topics };
      validateSubject(next);
      patch(subject.id, { topics });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const next = () => {
    try {
      subjects.forEach(validateSubject);
      validatePreferences(prefs);
      if (step === 1) {
        if (subjects.some((s) => !s.topics.length))
          throw new Error(
            "Add topics for every subject, or remove subjects without a syllabus.",
          );
        setPreview(buildPlan(subjects, prefs));
      }
      setError("");
      setStep(step + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="onboarding-shell">
      <header className="onboarding-topbar">
        <span className="brand-lockup">
          <strong>Syllabus AI</strong>
        </span>
        <button
          className="button button-secondary"
          onClick={() => {
            abort.current?.abort();
            onExit();
          }}
        >
          Exit setup
        </button>
      </header>
      <main className="onboarding-main">
        <div className="onboarding-progress-meta">
          <span>Build your study system</span>
          <strong>Step {step + 1} of 3</strong>
        </div>
        <div className="progress-track">
          <i style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>
        <section className="onboarding-card">
          <span className="section-kicker">
            {["YOUR GOAL", "YOUR SYLLABUS", "YOUR PLAN"][step]}
          </span>
          <h1>
            {
              [
                "Make your time count.",
                "Give each subject its own syllabus.",
                "A plan grounded in your availability.",
              ][step]
            }
          </h1>
          {step === 0 && (
            <>
              <div className="subject-draft-list">
                {subjects.map((s, i) => (
                  <div className="subject-draft-row" key={s.id}>
                    <label className="field-label">
                      Subject {i + 1}
                      <input
                        required
                        maxLength={160}
                        aria-label={`Subject ${i + 1} name`}
                        value={s.name}
                        placeholder="e.g. Data Structures"
                        onChange={(e) => patch(s.id, { name: e.target.value })}
                      />
                    </label>
                    <label className="field-label">
                      Exam date
                      <input
                        required
                        type="date"
                        value={s.examDate}
                        onChange={(e) =>
                          patch(s.id, { examDate: e.target.value })
                        }
                      />
                    </label>
                    <label className="field-label">
                      Difficulty
                      <select
                        value={s.difficulty}
                        onChange={(e) =>
                          patch(s.id, {
                            difficulty: e.target.value as Subject["difficulty"],
                          })
                        }
                      >
                        <option>Light</option>
                        <option>Medium</option>
                        <option>Heavy</option>
                      </select>
                    </label>
                    <button
                      className="utility-button danger-action"
                      disabled={subjects.length === 1}
                      aria-label={`Remove subject ${i + 1}`}
                      onClick={() =>
                        setSubjects(subjects.filter((v) => v.id !== s.id))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="button button-secondary"
                disabled={subjects.length >= 40}
                onClick={() => setSubjects([...subjects, blank()])}
              >
                Add another subject
              </button>
              <div className="modal-form-grid">
                <label className="field-label">
                  Daily study hours
                  <input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={prefs.dailyGoal}
                    onChange={(e) =>
                      setPrefs({ ...prefs, dailyGoal: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="field-label">
                  Preferred time
                  <select
                    value={prefs.preferredTime}
                    onChange={(e) =>
                      setPrefs({ ...prefs, preferredTime: e.target.value })
                    }
                  >
                    {["Morning", "Afternoon", "Evening", "Late night"].map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field-label">
                  Learning goal
                  <select
                    value={prefs.examType}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        examType: e.target.value as Preferences["examType"],
                      })
                    }
                  >
                    <option value="semester">Semester exams</option>
                    <option value="competitive">Competitive exams</option>
                    <option value="personal">Personal learning</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <fieldset>
                <legend>Study days</legend>
                <div className="day-picker">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (d) => (
                      <label key={d}>
                        <input
                          type="checkbox"
                          checked={prefs.studyDays.includes(d)}
                          onChange={(e) =>
                            setPrefs({
                              ...prefs,
                              studyDays: e.target.checked
                                ? [...prefs.studyDays, d]
                                : prefs.studyDays.filter((v) => v !== d),
                            })
                          }
                        />
                        {d}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            </>
          )}
          {step === 1 && (
            <>
              <p className="muted-copy">
                Manual input uses one topic per line with a 45-minute estimate.
                AI extraction sends your text or file to the configured provider
                and estimates topic effort.
              </p>
              {subjects.map((s) => (
                <section className="syllabus-subject" key={s.id}>
                  <h2>{s.name}</h2>
                  <label className="field-label">
                    Topics for {s.name}
                    <textarea
                      maxLength={200000}
                      value={texts[s.id] || ""}
                      placeholder="One topic per line"
                      onChange={(e) =>
                        setTexts({ ...texts, [s.id]: e.target.value })
                      }
                    />
                  </label>
                  <div className="toolbar-filters">
                    <button
                      className="button button-secondary"
                      disabled={Boolean(busy)}
                      onClick={() => manual(s)}
                    >
                      Use lines as manual topics
                    </button>
                    <button
                      className="button button-primary"
                      disabled={Boolean(busy) || !texts[s.id]?.trim()}
                      onClick={() => void importAI(s)}
                    >
                      Extract with AI
                    </button>
                    <label className="file-label">
                      Upload for AI
                      <input
                        type="file"
                        disabled={Boolean(busy)}
                        accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void importAI(s, file);
                        }}
                      />
                    </label>
                  </div>
                  <p role="status">
                    {busy === s.id
                      ? "Extracting…"
                      : `${s.topics.length} topics prepared for this subject`}
                  </p>
                  {s.topics.length > 0 && (
                    <ul className="import-preview">
                      {s.topics.map((t) => (
                        <li key={t.id}>
                          {t.title} · {t.minutes} min
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </>
          )}
          {step === 2 && preview && (
            <>
              <div className="metrics-grid">
                <article className="metric-card">
                  <span>Subjects</span>
                  <strong>{subjects.length}</strong>
                </article>
                <article className="metric-card">
                  <span>Topics</span>
                  <strong>
                    {subjects.reduce((n, s) => n + s.topics.length, 0)}
                  </strong>
                </article>
                <article className="metric-card">
                  <span>Scheduled blocks</span>
                  <strong>{preview.sessions.length}</strong>
                </article>
              </div>
              {preview.unscheduled.length > 0 && (
                <p className="plan-warning">
                  {preview.unscheduled.reduce((n, t) => n + t.minutes, 0)}{" "}
                  minutes do not fit before exams. Adjust availability or dates
                  to fit the workload.
                </p>
              )}
              <div className="preview-sessions">
                {preview.sessions.slice(0, 8).map((s) => (
                  <div key={s.id}>
                    <strong>
                      {
                        subjects
                          .flatMap((v) => v.topics)
                          .find((t) => t.id === s.topicId)?.title
                      }
                    </strong>
                    <span>
                      {s.date} · {s.start} · {s.duration} min
                    </span>
                  </div>
                ))}
              </div>
              <p className="muted-copy">
                All topics begin with no recorded progress. You can edit
                estimates and regenerate later.
              </p>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="onboarding-actions">
            <button
              className="button button-secondary"
              disabled={Boolean(busy)}
              onClick={() => (step ? setStep(step - 1) : onExit())}
            >
              {step ? "Back" : "Back to home"}
            </button>
            {step < 2 ? (
              <button
                disabled={Boolean(busy)}
                className="button button-primary"
                onClick={next}
              >
                {step === 1 ? "Generate my preview" : "Continue"}
              </button>
            ) : (
              <button
                className="button button-primary"
                onClick={() => {
                  try {
                    if (!preview) throw new Error("Generate a preview first.");
                    actions.completeOnboarding(
                      subjects,
                      prefs,
                      preview.sessions,
                    );
                    onComplete();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Enter my workspace
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
