import { useEffect, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import AccountServices from "./AccountServices";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  addDateDays,
  makeId,
  todayKey,
  validatePreferences,
  validateSession,
  validateSubject,
  validateTopic,
} from "../domain/workspace";
import type { DemoActions } from "../hooks/useDemoState";
import type {
  DemoState,
  PageId,
  Preferences,
  Priority,
  StudySession,
  Subject,
  Topic,
  TopicStatus,
} from "../types";
import {
  chatWithCoach,
  parseFile,
  parseSyllabus,
  type ChatMessage,
} from "../services/geminiService";
interface ViewProps {
  onSignIn?: () => void;
  state: DemoState;
  actions: DemoActions;
  searchQuery: string;
  onNavigate: (page: PageId) => void;
  onSelectSubject: (id: string) => void;
  displayName: string;
}
const dateLabel = (date: string) => format(parseISO(date), "MMM d, yyyy");
const matches = (value: string, query: string) =>
  value.toLowerCase().includes(query.toLowerCase());
const done = (s: Subject) =>
  s.topics.filter((t) => t.status === "Complete").length;
const progress = (s: Subject) =>
  Math.round((done(s) / Math.max(1, s.topics.length)) * 100);
function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading-row">
      <div className="page-heading">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="inline-empty">
      <p>{children}</p>
    </div>
  );
}
function Guard({ run }: { run: () => void }) {
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="button button-secondary"
        onClick={() => {
          try {
            run();
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Regenerate plan
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Popup className="modal-card">
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="utility-button" aria-label="Close dialog">
              Close
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function Confirm({
  title,
  description,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title={title} description={description} onClose={onClose}>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button button-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button button-danger"
          onClick={() => {
            try {
              onConfirm();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
}
function SessionRow({
  session,
  state,
  actions,
}: {
  session: StudySession;
  state: DemoState;
  actions: DemoActions;
}) {
  const [error, setError] = useState("");
  const subject = state.subjects.find((s) => s.id === session.subjectId),
    topic = subject?.topics.find((t) => t.id === session.topicId);
  return (
    <div className={`session-row ${session.status}`}>
      <span className="session-time">
        {session.start}
        <small>{session.duration} min</small>
      </span>
      <span className="session-marker" style={{ background: subject?.color }} />
      <div className="session-copy">
        <strong>{topic?.title || "Archived topic"}</strong>
        <small>
          {subject?.name || "Archived subject"} · {session.status}
        </small>
        {session.note && <small>{session.note}</small>}
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        className="utility-button"
        aria-label={
          session.status === "completed"
            ? "Undo completion"
            : `Complete ${topic?.title || "session"}`
        }
        onClick={() => {
          try {
            actions.setSessionStatus(
              session.id,
              session.status === "completed" ? "planned" : "completed",
            );
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {session.status === "completed" ? "Undo" : "Done"}
      </button>
    </div>
  );
}
function FocusChart({ state, range }: { state: DemoState; range: string }) {
  const today = todayKey(),
    start =
      range === "Week"
        ? todayKey(startOfWeek(new Date(), { weekStartsOn: 1 }))
        : range === "Month"
          ? todayKey(startOfMonth(new Date()))
          : state.studyLog[0]?.date || today;
  const logs = state.studyLog.filter((l) => l.date >= start && l.date <= today);
  const points =
    range === "Week"
      ? Array.from({ length: 7 }, (_, i) => {
          const date = addDateDays(start, i);
          return { date, hours: logs.find((l) => l.date === date)?.hours || 0 };
        })
      : logs;
  const max = Math.max(1, ...points.map((l) => l.hours));
  return (
    <>
      <div
        className="chart-wrap"
        role="img"
        aria-label={`Actual study hours, ${range.toLowerCase()}: ${points.map((l) => `${l.date}: ${l.hours} hours`).join("; ") || "No recorded study"}`}
      >
        <div className="focus-bars">
          {points.map((l) => (
            <div className="focus-bar" key={l.date}>
              <span>{l.hours.toFixed(1)}h</span>
              <i
                style={{ height: `${Math.max(2, (l.hours / max) * 155)}px` }}
              />
              <small>
                {format(parseISO(l.date), range === "Week" ? "EEE" : "MMM d")}
              </small>
            </div>
          ))}
        </div>
      </div>
      {!logs.length && (
        <p className="muted-copy">
          Complete a study session to begin recording focus time.
        </p>
      )}
    </>
  );
}
export function DashboardPage({
  state,
  actions,
  onNavigate,
  onSelectSubject,
  searchQuery,
  displayName,
}: ViewProps) {
  const [range, setRange] = useState("Week"),
    today = todayKey(),
    week = todayKey(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const topics = state.subjects.flatMap((s) => s.topics),
    complete = topics.filter((t) => t.status === "Complete").length;
  const hours = state.studyLog
    .filter((l) => l.date >= week && l.date <= today)
    .reduce((n, l) => n + l.hours, 0);
  const studied = new Set(
    state.studyLog.filter((l) => l.hours > 0).map((l) => l.date),
  );
  let streak = 0,
    cursor = studied.has(today) ? today : addDateDays(today, -1);
  while (studied.has(cursor)) {
    streak++;
    cursor = addDateDays(cursor, -1);
  }
  const sessions = state.sessions
    .filter(
      (s) =>
        s.date === today &&
        matches(
          `${state.subjects.find((v) => v.id === s.subjectId)?.name} ${state.subjects.flatMap((v) => v.topics).find((t) => t.id === s.topicId)?.title}`,
          searchQuery,
        ),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const next = state.subjects
    .flatMap((s) =>
      s.topics.filter((t) => t.status !== "Complete").map((t) => ({ s, t })),
    )
    .sort((a, b) => a.s.examDate.localeCompare(b.s.examDate))[0];
  return (
    <div className="app-page dashboard-page">
      <Heading
        title={`Welcome back, ${displayName.split(" ")[0]}`}
        description={format(new Date(), "EEEE, MMMM d · yyyy")}
      >
        <button
          className="button button-primary"
          onClick={() => onNavigate("planner")}
        >
          Open study plan
        </button>
      </Heading>
      <section className="dashboard-focus-card">
        <div>
          <span className="section-kicker">Next recommended topic</span>
          <h2>{next ? next.t.title : "Make room for your next goal."}</h2>
          <p>
            {next
              ? `${next.s.name} · ${next.t.priority} priority · ${next.t.minutes} minutes estimated effort`
              : "Add a subject and its topics to build your plan."}
          </p>
          <button
            className="button button-primary"
            onClick={() =>
              next ? onSelectSubject(next.s.id) : onNavigate("subjects")
            }
          >
            {next ? "Open topic workspace" : "Add your first subject"}{" "}
          </button>
        </div>
        <div className="focus-number">
          {topics.length ? Math.round((complete / topics.length) * 100) : 0}
          <span>% complete</span>
        </div>
      </section>
      <div className="metrics-grid">
        {[
          [
            "Study time this week",
            `${hours.toFixed(1)}h`,
            "Recorded completed sessions",
          ],
          [
            "Syllabus completion",
            `${topics.length ? Math.round((complete / topics.length) * 100) : 0}%`,
            `${complete} of ${topics.length} topics`,
          ],
          ["Active subjects", state.subjects.length, "Your current curriculum"],
          [
            "Current streak",
            `${streak} days`,
            "Consecutive days with recorded study",
          ],
        ].map(([label, value, caption]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="surface-card">
          <div className="card-heading-row">
            <h2>Today’s study plan</h2>
            <button
              className="text-button"
              onClick={() => onNavigate("planner")}
            >
              View planner
            </button>
          </div>
          {sessions.length ? (
            sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                state={state}
                actions={actions}
              />
            ))
          ) : (
            <Empty>No sessions scheduled today.</Empty>
          )}
        </section>
        <section className="surface-card">
          <div className="card-heading-row">
            <h2>Focus overview</h2>
            <Pills
              values={["Week", "Month", "All time"]}
              value={range}
              onChange={setRange}
            />
          </div>
          <FocusChart state={state} range={range} />
        </section>
      </div>
      <section className="surface-card">
        <div className="card-heading-row">
          <h2>Subject progress</h2>
          <button
            className="text-button"
            onClick={() => onNavigate("subjects")}
          >
            Manage subjects
          </button>
        </div>
        {state.subjects
          .filter((s) => matches(s.name, searchQuery))
          .map((s) => (
            <button
              className="subject-progress-row"
              key={s.id}
              onClick={() => onSelectSubject(s.id)}
            >
              <span
                className="subject-color-dot"
                style={{ background: s.color }}
              />
              <strong>{s.name}</strong>
              <span>Exam {dateLabel(s.examDate)}</span>
              <div className="progress-bar">
                <i style={{ width: `${progress(s)}%`, background: s.color }} />
              </div>
              <b>{progress(s)}%</b>
            </button>
          ))}
      </section>
    </div>
  );
}
function Pills({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="select-pills">
      {values.map((v) => (
        <button
          key={v}
          aria-pressed={v === value}
          className={v === value ? "is-selected" : ""}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
function SubjectForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: Subject;
  onClose: () => void;
  onSave: (v: Subject) => void;
}) {
  const [form, setForm] = useState<Subject>(
    initial || {
      id: makeId(),
      name: "",
      examDate: addDateDays(todayKey(), 30),
      color: "#27fb6b",
      difficulty: "Medium",
      topics: [],
    },
  );
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const value = { ...form, name: form.name.trim() };
      validateSubject(value);
      onSave(value);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      title={initial ? "Edit subject" : "Add subject"}
      description="Set a deadline and manageable workload."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <label className="field-label">
          Subject name
          <input
            required
            maxLength={160}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <div className="modal-form-grid">
          <label className="field-label">
            Exam date
            <input
              required
              type="date"
              value={form.examDate}
              onChange={(e) => setForm({ ...form, examDate: e.target.value })}
            />
          </label>
          <label className="field-label">
            Difficulty
            <select
              value={form.difficulty}
              onChange={(e) =>
                setForm({
                  ...form,
                  difficulty: e.target.value as Subject["difficulty"],
                })
              }
            >
              <option>Light</option>
              <option>Medium</option>
              <option>Heavy</option>
            </select>
          </label>
        </div>
        <label className="field-label">
          Subject color
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary">
            {initial ? "Save changes" : "Add subject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function SubjectsPage({
  state,
  actions,
  searchQuery,
  onSelectSubject,
}: ViewProps) {
  const [editing, setEditing] = useState<Subject | null | undefined>(undefined),
    [deleting, setDeleting] = useState<Subject | null>(null);
  return (
    <div className="app-page">
      <Heading
        title="My subjects"
        description="A clear home for every course and deadline."
      >
        <button
          className="button button-primary"
          onClick={() => setEditing(null)}
        >
          Add subject
        </button>
      </Heading>
      <div className="subject-card-grid">
        {state.subjects
          .filter((s) =>
            matches(
              `${s.name} ${s.topics.map((t) => t.title).join(" ")}`,
              searchQuery,
            ),
          )
          .map((s) => (
            <article className="subject-card" key={s.id}>
              <div className="subject-card-top">
                <span className="difficulty-badge">{s.difficulty} load</span>
              </div>
              <button
                className="subject-open"
                onClick={() => onSelectSubject(s.id)}
              >
                <h2>{s.name}</h2>
                <p>
                  {s.topics.length} topics · Exam {dateLabel(s.examDate)}
                </p>
              </button>
              <div className="progress-bar">
                <i style={{ width: `${progress(s)}%`, background: s.color }} />
              </div>
              <div className="subject-card-footer">
                <b>{progress(s)}% complete</b>
                <button className="text-button" onClick={() => setEditing(s)}>
                  Edit
                </button>
                <button
                  className="utility-button danger-action"
                  onClick={() => setDeleting(s)}
                  aria-label={`Delete ${s.name}`}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
      </div>
      {!state.subjects.length && (
        <Empty>Add your first subject to start planning.</Empty>
      )}
      {editing !== undefined && (
        <SubjectForm
          initial={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSave={(v) =>
            editing ? actions.updateSubject(v.id, v) : actions.addSubject(v)
          }
        />
      )}{" "}
      {deleting && (
        <Confirm
          title={`Delete ${deleting.name}?`}
          description="Planned sessions are removed. Completed study records stay in history."
          onClose={() => setDeleting(null)}
          onConfirm={() => actions.deleteSubject(deleting.id)}
        />
      )}
    </div>
  );
}
function TopicForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: Topic;
  onClose: () => void;
  onSave: (t: Topic) => void;
}) {
  const [form, setForm] = useState<Topic>(
      initial || {
        id: makeId(),
        title: "",
        chapter: "General",
        minutes: 45,
        priority: "Medium",
        status: "Not started",
        revisionStatus: "New",
        notes: "",
      },
    ),
    [error, setError] = useState("");
  return (
    <Modal
      title={initial ? "Edit topic" : "Add topic"}
      description="Estimate effort so your plan stays realistic."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            validateTopic(form);
            onSave(form);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label className="field-label">
          Topic title
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <div className="modal-form-grid">
          <label className="field-label">
            Chapter
            <input
              required
              maxLength={160}
              value={form.chapter}
              onChange={(e) => setForm({ ...form, chapter: e.target.value })}
            />
          </label>
          <label className="field-label">
            Estimated minutes
            <input
              required
              type="number"
              min={10}
              max={1440}
              value={form.minutes}
              onChange={(e) =>
                setForm({ ...form, minutes: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label className="field-label">
          Priority
          <select
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: e.target.value as Priority })
            }
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>
        <label className="field-label">
          Notes
          <textarea
            maxLength={4000}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary">Save topic</button>
        </div>
      </form>
    </Modal>
  );
}
export function SubjectDetailPage({
  state,
  actions,
  subjectId,
  onNavigate,
  searchQuery,
}: ViewProps & { subjectId: string | null }) {
  const subject = state.subjects.find((s) => s.id === subjectId),
    [editing, setEditing] = useState<Topic | null | undefined>(),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [deleting, setDeleting] = useState<Topic | null>(null),
    [error, setError] = useState(""),
    [importing, setImporting] = useState(false),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("All");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  if (!subject)
    return (
      <div className="app-page">
        <Empty>Choose a subject from your library.</Empty>
        <button
          className="button button-secondary"
          onClick={() => onNavigate("subjects")}
        >
          Back to subjects
        </button>
      </div>
    );
  const selected = subject.topics.find((t) => t.id === selectedId);
  const importTopics = async (file?: File) => {
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const topics = file
        ? await parseFile(file, controller.signal)
        : await parseSyllabus(text, "text/plain", controller.signal);
      const mapped = topics.map(
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
      );
      if (controller.signal.aborted) return;
      actions.updateSubject(subject.id, {
        topics: [...subject.topics, ...mapped],
      });
      setImporting(false);
      setText("");
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };
  const status = (topic: Topic, value: TopicStatus) => {
    try {
      actions.setTopicStatus(subject.id, topic.id, value);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="app-page">
      <button className="back-link" onClick={() => onNavigate("subjects")}>
        Back to subjects
      </button>
      <Heading
        title={subject.name}
        description={`Exam ${dateLabel(subject.examDate)} · ${progress(subject)}% complete`}
      >
        <div className="toolbar-filters">
          <button
            className="button button-secondary"
            onClick={() => setImporting(true)}
          >
            Import syllabus
          </button>
          <button
            className="button button-primary"
            onClick={() => setEditing(null)}
          >
            Add topic
          </button>
        </div>
      </Heading>
      <Pills
        values={["All", "Not started", "In progress", "Complete"]}
        value={filter}
        onChange={setFilter}
      />
      {error && !importing && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="surface-card topic-list">
        {subject.topics
          .filter(
            (t) =>
              (filter === "All" || t.status === filter) &&
              matches(`${t.title} ${t.chapter}`, searchQuery),
          )
          .map((t) => (
            <div className="topic-row" key={t.id}>
              <button
                className="utility-button"
                aria-label={`${t.status === "Complete" ? "Mark incomplete" : "Mark complete"} ${t.title}`}
                onClick={() =>
                  status(
                    t,
                    t.status === "Complete" ? "Not started" : "Complete",
                  )
                }
              >
                {t.status === "Complete" ? "Undo" : "Done"}
              </button>
              <button
                className="topic-open"
                onClick={() => setSelectedId(t.id)}
              >
                <strong>{t.title}</strong>
                <small>
                  {t.chapter} · {t.minutes} min · {t.status}
                </small>
              </button>
              <span className={`priority-badge ${t.priority.toLowerCase()}`}>
                {t.priority}
              </span>
              <button className="text-button" onClick={() => setEditing(t)}>
                Edit
              </button>
              <button
                className="utility-button danger-action"
                aria-label={`Delete ${t.title}`}
                onClick={() => setDeleting(t)}
              >
                Delete
              </button>
            </div>
          ))}
        {!subject.topics.length && (
          <Empty>Add topics manually or import a syllabus using AI.</Empty>
        )}
      </section>
      {editing !== undefined && (
        <TopicForm
          initial={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSave={(t) =>
            editing
              ? actions.updateTopic(subject.id, t.id, t)
              : actions.addTopic(subject.id, t)
          }
        />
      )}{" "}
      {selected && (
        <Modal
          title={selected.title}
          description={`${subject.name} · ${selected.chapter}`}
          onClose={() => setSelectedId(null)}
        >
          <p>
            {selected.minutes} minutes · {selected.priority} priority ·{" "}
            {selected.status}
          </p>
          <p className="topic-notes">{selected.notes || "No notes yet."}</p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => {
                setEditing(selected);
                setSelectedId(null);
              }}
            >
              Edit topic
            </button>
            <button
              className="button button-primary"
              onClick={() =>
                status(
                  selected,
                  selected.status === "Complete" ? "Not started" : "Complete",
                )
              }
            >
              {selected.status === "Complete"
                ? "Mark incomplete"
                : "Mark complete"}
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title={`Delete ${deleting.title}?`}
          description="Completed study records stay in history."
          onClose={() => setDeleting(null)}
          onConfirm={() => actions.deleteTopic(subject.id, deleting.id)}
        />
      )}{" "}
      {importing && (
        <Modal
          title="Import syllabus"
          description="AI sends this document to your configured Gemini provider. Review the imported estimates afterward."
          onClose={() => {
            abort.current?.abort();
            setImporting(false);
          }}
        >
          <label className="field-label">
            Syllabus file
            <input
              disabled={busy}
              type="file"
              accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importTopics(file);
              }}
            />
          </label>
          <label className="field-label">
            Syllabus text
            <textarea
              maxLength={200000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            disabled={busy || !text.trim()}
            className="button button-primary"
            onClick={() => void importTopics()}
          >
            {busy ? "Extracting topics…" : "Extract with AI"}
          </button>
        </Modal>
      )}
    </div>
  );
}
function SessionForm({
  initial,
  state,
  onClose,
  onSave,
  onDelete,
}: {
  initial: StudySession;
  state: DemoState;
  onClose: () => void;
  onSave: (s: StudySession) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState(initial),
    [error, setError] = useState("");
  const subject = state.subjects.find((s) => s.id === form.subjectId);
  return (
    <Modal
      title={onDelete ? "Edit study session" : "Add a study session"}
      description="Choose a topic and a time that does not overlap another session."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            validateSession(form, state.subjects, form.status === "completed");
            onSave(form);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="modal-form-grid">
          <label className="field-label">
            Date
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="field-label">
            Start time
            <input
              required
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </label>
        </div>
        <label className="field-label">
          Subject
          <select
            required
            value={form.subjectId}
            onChange={(e) => {
              const s = state.subjects.find((s) => s.id === e.target.value);
              setForm({
                ...form,
                subjectId: e.target.value,
                topicId: s?.topics[0]?.id || "",
              });
            }}
          >
            <option value="">Choose a subject</option>
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Topic
          <select
            required
            value={form.topicId}
            onChange={(e) => setForm({ ...form, topicId: e.target.value })}
          >
            <option value="">Choose a topic</option>
            {subject?.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-form-grid">
          <label className="field-label">
            Duration
            <input
              required
              type="number"
              min={5}
              max={720}
              value={form.duration}
              onChange={(e) =>
                setForm({ ...form, duration: Number(e.target.value) })
              }
            />
          </label>
          <label className="field-label">
            Status
            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as StudySession["status"],
                })
              }
            >
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
            </select>
          </label>
        </div>
        <label className="field-label">
          Session note
          <textarea
            maxLength={2000}
            value={form.note || ""}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {onDelete && (
            <button
              type="button"
              className="button button-danger-outline"
              onClick={onDelete}
            >
              Delete session
            </button>
          )}
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary">
            {onDelete ? "Save session" : "Add session"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function PlannerPage({ state, actions, searchQuery }: ViewProps) {
  const [cursor, setCursor] = useState(todayKey()),
    [mode, setMode] = useState("Week"),
    [subjectId, setSubjectId] = useState("all"),
    [editing, setEditing] = useState<StudySession | null>(null),
    [deleting, setDeleting] = useState<StudySession | null>(null);
  const start = startOfWeek(parseISO(cursor), { weekStartsOn: 1 }),
    days =
      mode === "Day"
        ? [parseISO(cursor)]
        : eachDayOfInterval({
            start,
            end: endOfWeek(start, { weekStartsOn: 1 }),
          });
  const newSession = () => {
    const s = state.subjects.find((s) => s.topics.length);
    setEditing({
      id: makeId(),
      date: cursor,
      start: "18:00",
      duration: 45,
      subjectId: s?.id || "",
      topicId: s?.topics[0]?.id || "",
      priority: "Medium",
      status: "planned",
    });
  };
  return (
    <div className="app-page">
      <Heading
        title="Study Planner"
        description="Protect your focus. Adjust your plan as life changes."
      >
        <div className="toolbar-filters">
          <Guard run={actions.regeneratePlan} />
          <button className="button button-primary" onClick={newSession}>
            Add session
          </button>
        </div>
      </Heading>
      {actions.unscheduled.length > 0 && (
        <div role="status" className="plan-warning">
          <strong>Your workload exceeds the available schedule.</strong>
          <p>
            {actions.unscheduled.reduce((n, t) => n + t.minutes, 0)} minutes
            remain before exam deadlines. Increase available hours, add days, or
            adjust deadlines and estimates, then regenerate.
          </p>
        </div>
      )}
      <div className="planner-toolbar">
        <div className="toolbar-filters">
          <button
            className="utility-button"
            aria-label="Previous week"
            onClick={() =>
              setCursor(addDateDays(cursor, mode === "Day" ? -1 : -7))
            }
          >
            Previous
          </button>
          <strong>{dateLabel(cursor)}</strong>
          <button
            className="utility-button"
            aria-label="Next week"
            onClick={() =>
              setCursor(addDateDays(cursor, mode === "Day" ? 1 : 7))
            }
          >
            Next
          </button>
          <button className="text-button" onClick={() => setCursor(todayKey())}>
            Today
          </button>
        </div>
        <Pills values={["Day", "Week"]} value={mode} onChange={setMode} />
        <label>
          Subject{" "}
          <select
            aria-label="Filter subjects"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="all">All subjects</option>
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={`planner-board ${mode === "Day" ? "day-mode" : ""}`}>
        {days.map((day) => {
          const date = todayKey(day),
            sessions = state.sessions
              .filter(
                (s) =>
                  s.date === date &&
                  (subjectId === "all" || s.subjectId === subjectId) &&
                  matches(
                    `${state.subjects.find((v) => v.id === s.subjectId)?.name} ${state.subjects.flatMap((v) => v.topics).find((t) => t.id === s.topicId)?.title}`,
                    searchQuery,
                  ),
              )
              .sort((a, b) => a.start.localeCompare(b.start));
          return (
            <section
              className={`planner-day ${date === todayKey() ? "is-today" : ""}`}
              key={date}
            >
              <header>
                <span>{format(day, "EEE")}</span>
                <strong>{format(day, "d")}</strong>
                <small>
                  {sessions.reduce((n, s) => n + s.duration, 0)} min
                </small>
              </header>
              {sessions.map((s) => (
                <button
                  className={`planner-session ${s.status}`}
                  key={s.id}
                  onClick={() => setEditing(s)}
                  style={{
                    borderLeftColor: state.subjects.find(
                      (v) => v.id === s.subjectId,
                    )?.color,
                  }}
                >
                  <span>
                    {s.start} · {s.duration} min
                  </span>
                  <strong>
                    {state.subjects
                      .flatMap((v) => v.topics)
                      .find((t) => t.id === s.topicId)?.title ||
                      "Archived topic"}
                  </strong>
                  <small>
                    {state.subjects.find((v) => v.id === s.subjectId)?.name ||
                      "Archived subject"}{" "}
                    · {s.status}
                  </small>
                </button>
              ))}
              {!sessions.length && (
                <p className="planner-empty">Open focus time</p>
              )}
            </section>
          );
        })}
      </div>
      {editing && (
        <SessionForm
          initial={editing}
          state={state}
          onClose={() => setEditing(null)}
          onSave={(s) =>
            state.sessions.some((v) => v.id === s.id)
              ? actions.updateSession(s.id, s)
              : actions.addSession(s)
          }
          onDelete={
            state.sessions.some((s) => s.id === editing.id)
              ? () => {
                  setDeleting(editing);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}{" "}
      {deleting && (
        <Confirm
          title="Delete session?"
          description="Deleting a completed session also removes its recorded study time."
          onClose={() => setDeleting(null)}
          onConfirm={() => actions.deleteSession(deleting.id)}
        />
      )}
    </div>
  );
}
export function CalendarPage({ state, searchQuery, onNavigate }: ViewProps) {
  const [month, setMonth] = useState(new Date()),
    [filter, setFilter] = useState("all");
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <div className="app-page">
      <Heading
        title="Calendar"
        description="See study blocks and exam deadlines together."
      />
      <div className="planner-toolbar">
        <div className="toolbar-filters">
          <button
            className="utility-button"
            aria-label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            Previous
          </button>
          <h2>{format(month, "MMMM yyyy")}</h2>
          <button
            className="utility-button"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            Next
          </button>
        </div>
        <label>
          Subject{" "}
          <select
            aria-label="Filter calendar subjects"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All subjects</option>
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div className="calendar-weekday" key={d}>
              {d}
            </div>
          ))}
          {days.map((day) => {
            const date = todayKey(day);
            const subjects = state.subjects.filter(
              (s) =>
                (filter === "all" || s.id === filter) &&
                matches(
                  `${s.name} ${s.topics.map((t) => t.title).join(" ")}`,
                  searchQuery,
                ),
            );
            const ids = new Set(subjects.map((s) => s.id));
            return (
              <div
                className={`calendar-cell ${day.getMonth() !== month.getMonth() ? "outside-month" : ""}`}
                key={date}
              >
                <strong>{format(day, "d")}</strong>
                {subjects
                  .filter((s) => s.examDate === date)
                  .map((s) => (
                    <div
                      className="calendar-event exam"
                      style={{ borderColor: s.color }}
                      key={s.id}
                    >
                      Exam · {s.name}
                    </div>
                  ))}
                {state.sessions
                  .filter((s) => s.date === date && ids.has(s.subjectId))
                  .map((s) => (
                    <button
                      className="calendar-event"
                      onClick={() => onNavigate("planner")}
                      key={s.id}
                    >
                      {s.start} ·{" "}
                      {state.subjects
                        .flatMap((v) => v.topics)
                        .find((t) => t.id === s.topicId)?.title || "Archived"}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export function AnalyticsPage({ state }: ViewProps) {
  const [range, setRange] = useState("Week");
  const completed = state.sessions.filter((s) => s.status === "completed"),
    minutes = completed.reduce((n, s) => n + s.duration, 0);
  return (
    <div className="app-page">
      <Heading
        title="Progress analytics"
        description="Recorded effort and topic completion, drawn from your workspace."
      />
      <section className="surface-card">
        <div className="card-heading-row">
          <h2>Study history</h2>
          <Pills
            values={["Week", "Month", "All time"]}
            value={range}
            onChange={setRange}
          />
        </div>
        <FocusChart state={state} range={range} />
      </section>
      <div className="metrics-grid">
        <article className="metric-card">
          <span>Total recorded study</span>
          <strong>
            {state.studyLog.reduce((n, l) => n + l.hours, 0).toFixed(1)}h
          </strong>
          <small>Includes preserved study history</small>
        </article>
        <article className="metric-card">
          <span>Completed session blocks</span>
          <strong>{completed.length}</strong>
          <small>{(minutes / 60).toFixed(1)}h in retained sessions</small>
        </article>
        <article className="metric-card">
          <span>Missed sessions</span>
          <strong>
            {state.sessions.filter((s) => s.status === "missed").length}
          </strong>
          <small>Explicitly marked as missed</small>
        </article>
      </div>
      <section className="surface-card">
        <h2>Effort by subject</h2>
        {state.subjects.map((s) => (
          <div className="subject-progress-row" key={s.id}>
            <span
              className="subject-color-dot"
              style={{ background: s.color }}
            />
            <strong>{s.name}</strong>
            <span>
              {(
                completed
                  .filter((v) => v.subjectId === s.id)
                  .reduce((n, v) => n + v.duration, 0) / 60
              ).toFixed(1)}
              h
            </span>
            <span>
              {done(s)}/{s.topics.length} topics complete
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
export function CoachPage({ state, actions }: ViewProps) {
  const key = `syllabus-ai-chat:${actions.scope}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value)
          ? value
              .filter(
                (v) =>
                  v &&
                  ["user", "assistant"].includes(v.role) &&
                  typeof v.text === "string" &&
                  v.text.length <= 16000,
              )
              .slice(-40)
          : [];
      } catch {
        return [];
      }
    }),
    [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const persist = (next: ChatMessage[]) => {
    localStorage.setItem(key, JSON.stringify(next.slice(-40)));
    setMessages(next.slice(-40));
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const message = input.trim();
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const reply = await chatWithCoach(
        message,
        {
          subjects: state.subjects,
          sessions: state.sessions
            .filter((s) => s.status === "planned")
            .slice(0, 100),
          preferences: state.preferences,
        },
        messages.slice(-20),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      persist([
        ...messages,
        { role: "user", text: message },
        { role: "assistant", text: reply },
      ]);
      setInput("");
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };
  return (
    <div className="app-page coach-page">
      <Heading
        title="AI study coach"
        description="Ask about your workload, revision strategy, or a difficult topic."
      />
      <div className="coach-notice">
        Messages and selected workspace data are sent to your configured AI
        provider. The coach offers advice; use the planner to change sessions.
      </div>
      <section className="surface-card chat-card">
        <div className="chat-messages" aria-live="polite">
          {!messages.length && (
            <Empty>
              Try “Which topics should I prioritize before my next exam?”
            </Empty>
          )}
          {messages.map((m, i) => (
            <article className={`chat-message ${m.role}`} key={i}>
              <strong>{m.role === "user" ? "You" : "Study coach"}</strong>
              <p>{m.text}</p>
            </article>
          ))}
          {busy && <p role="status">Thinking through your plan…</p>}
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <form className="chat-form" onSubmit={send}>
          <label className="field-label">
            Message
            <textarea
              required
              maxLength={4000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your study coach…"
            />
          </label>
          <button
            className="button button-primary"
            disabled={busy || !input.trim()}
          >
            {busy ? "Thinking…" : "Send message"}
          </button>
          {busy && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                abort.current?.abort();
                setBusy(false);
              }}
            >
              Cancel
            </button>
          )}
        </form>
        <button
          className="text-button"
          onClick={() => {
            try {
              persist([]);
              setError("");
            } catch {
              setError("Could not clear chat from browser storage.");
            }
          }}
        >
          Clear conversation on this browser
        </button>
      </section>
    </div>
  );
}
export function SettingsPage({
  state,
  actions,
  displayName,
  onSignIn,
}: ViewProps) {
  const [form, setForm] = useState<Preferences>(state.preferences),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [reset, setReset] = useState(false),
    [reload, setReload] = useState(false);
  const save = (e: FormEvent) => {
    e.preventDefault();
    try {
      validatePreferences(form);
      actions.savePreferences(form);
      setSaved(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="app-page">
      <Heading
        title="Settings"
        description="Set your rhythm and manage your workspace."
      />
      <section className="surface-card">
        <h2>{displayName}</h2>
        <p className="muted-copy">
          {actions.isCloud
            ? "Authenticated cloud workspace"
            : "Local workspace · stored in this browser"}
        </p>
      </section>
      <form onSubmit={save} className="surface-card settings-form">
        <h2>Study preferences</h2>
        <div className="modal-form-grid">
          <label className="field-label">
            Daily study hours
            <input
              required
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={form.dailyGoal}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, dailyGoal: Number(e.target.value) });
              }}
            />
          </label>
          <label className="field-label">
            Preferred study time
            <select
              value={form.preferredTime}
              onChange={(e) =>
                setForm({ ...form, preferredTime: e.target.value })
              }
            >
              {["Morning", "Afternoon", "Evening", "Late night"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Study days</legend>
          <div className="day-picker">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={form.studyDays.includes(day)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      studyDays: e.target.checked
                        ? [...form.studyDays, day]
                        : form.studyDays.filter((d) => d !== day),
                    })
                  }
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field-label">
          Learning goal
          <select
            value={form.examType || "semester"}
            onChange={(e) =>
              setForm({
                ...form,
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
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.notifications}
            onChange={(e) =>
              setForm({ ...form, notifications: e.target.checked })
            }
          />{" "}
          Show upcoming sessions in the reminder panel
        </label>
        <p className="muted-copy">
          This toggle controls the in-app reminder panel. Configure email and
          background delivery separately below.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status">
            Preferences updated
            {actions.isCloud
              ? " · cloud save pending or complete"
              : " in this browser"}
            . Regenerate the plan to apply schedule changes.
          </p>
        )}
        <button className="button button-primary">Save preferences</button>
      </form>
      <AccountServices isCloud={actions.isCloud} onSignIn={onSignIn} />
      <section className="surface-card">
        <h2>Data management</h2>
        <p className="muted-copy">
          Export your workspace before removing data or resolving a cloud
          conflict.
        </p>
        <div className="toolbar-filters">
          <button
            className="button button-secondary"
            onClick={() => {
              try {
                actions.exportData();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Export workspace
          </button>
          {actions.isCloud ? (
            <button
              className="button button-danger-outline"
              onClick={() => setReload(true)}
            >
              Reload cloud data
            </button>
          ) : (
            <button
              className="button button-danger-outline"
              onClick={() => setReset(true)}
            >
              Reset demo data
            </button>
          )}
        </div>
      </section>
      {reset && (
        <Confirm
          title="Reset local demo workspace?"
          description="This replaces local subjects, sessions, preferences, and history with sample data. Export first to keep your edits."
          onClose={() => setReset(false)}
          onConfirm={() => {
            actions.resetDemoData();
            setForm({ ...state.preferences, theme: "dark" });
          }}
        />
      )}
      {reload && (
        <Confirm
          title="Discard local edits and reload cloud?"
          description="Export first. Unsent edits will be discarded from this browser; cloud data is preserved."
          onClose={() => setReload(false)}
          onConfirm={actions.reloadCloud}
        />
      )}
    </div>
  );
}
