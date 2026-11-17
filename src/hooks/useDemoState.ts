import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cloneInitialState } from "../data/demoData";
import {
  applySessionChange,
  decodeWorkspace,
  emptyWorkspace,
  sessionsOverlap,
  validateWorkspace,
} from "../domain/workspace";
import { buildPlan } from "../domain/planning";
const cloudService = () => import("../services/workspaceService");
import type {
  DemoState,
  Preferences,
  SessionStatus,
  StudySession,
  Subject,
  Topic,
  TopicStatus,
} from "../types";

const LOCAL_KEY = "syllabus-ai-workspace-v3";
type Entry = {
  scope: string;
  state: DemoState;
  revision: number;
  ready: boolean;
  dirty: boolean;
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Workspace operation failed.";
export function useDemoState(
  options: { userId?: string | null; cloudEnabled?: boolean } = {},
) {
  const uid = options.cloudEnabled ? options.userId : null,
    scope = uid ? `cloud:${uid}` : "local";
  const [entry, setEntry] = useState<Entry>({
    scope: "",
    state: emptyWorkspace(),
    revision: 0,
    ready: false,
    dirty: false,
  });
  const ref = useRef(entry);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [reload, setReload] = useState(0);
  const publish = useCallback((next: Entry) => {
    ref.current = next;
    setEntry(next);
  }, []);
  const backup = useCallback((value: Entry) => {
    localStorage.setItem(
      value.scope === "local" ? LOCAL_KEY : `syllabus-ai-backup:${value.scope}`,
      JSON.stringify(
        value.scope === "local"
          ? value.state
          : {
              state: value.state,
              revision: value.revision,
              pending: value.dirty,
            },
      ),
    );
  }, []);
  useEffect(() => {
    let cancelled = false;
    publish({
      scope,
      state: emptyWorkspace(),
      revision: 0,
      ready: false,
      dirty: false,
    });
    setError("");
    setSyncStatus("idle");
    async function load() {
      try {
        let state: DemoState,
          revision = 0,
          dirty = false;
        if (uid) {
          const cloud = await (await cloudService()).loadWorkspace(uid);
          state = cloud.state;
          revision = cloud.revision;
          const raw = localStorage.getItem(`syllabus-ai-backup:${scope}`);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved.pending) {
              if (saved.revision !== revision)
                throw new Error(
                  "Unsent local edits conflict with cloud changes. Export the local backup before reloading cloud data.",
                );
              state = decodeWorkspace(saved.state);
              dirty = true;
            }
          }
        } else {
          const raw = localStorage.getItem(LOCAL_KEY);
          state = raw ? decodeWorkspace(JSON.parse(raw)) : cloneInitialState();
          state.preferences.theme = state.preferences.theme ?? "dark";
        }
        if (cancelled) return;
        const next = { scope, state, revision, dirty, ready: true };
        backup(next);
        publish(next);
      } catch (e) {
        if (!cancelled) {
          setError(message(e));
          setSyncStatus("error");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [uid, scope, reload, publish, backup]);
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (saving.current) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return flushSave();
    }
    const current = ref.current;
    if (!current.ready || current.scope !== scopeRef.current) return false;
    if (!current.dirty || !uid) return true;
    saving.current = true;
    setSyncStatus("saving");
    try {
      let snapshot = ref.current;
      while (snapshot.dirty && snapshot.scope === scopeRef.current) {
        const revision = await (
          await cloudService()
        ).saveWorkspace(uid, snapshot.state, snapshot.revision);
        if (
          ref.current.scope !== snapshot.scope ||
          scopeRef.current !== snapshot.scope
        )
          return false;
        const latest = ref.current;
        const next = {
          ...latest,
          revision,
          dirty: latest.state !== snapshot.state,
        };
        backup(next);
        publish(next);
        snapshot = next;
      }
      setSyncStatus("saved");
      setError("");
      return true;
    } catch (e) {
      if (ref.current.scope === current.scope) {
        setSyncStatus("error");
        setError(message(e));
      }
      return false;
    } finally {
      saving.current = false;
    }
  }, [uid, backup, publish]);
  useEffect(() => {
    if (!entry.dirty || !entry.ready || syncStatus === "error") return;
    const timer = setTimeout(() => void flushSave(), 400);
    return () => clearTimeout(timer);
  }, [entry, flushSave, syncStatus]);
  useEffect(() => {
    if (!uid || !entry.ready) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void cloudService()
      .then(({ observeWorkspace }) => {
        if (cancelled) return;
        unsubscribe = observeWorkspace(
          uid,
          (revision) => {
            const current = ref.current;
            if (
              current.scope !== scope ||
              saving.current ||
              revision === current.revision
            )
              return;
            if (current.dirty) {
              setError(
                "Cloud data changed while local edits were pending. Export your edits, then reload.",
              );
              setSyncStatus("error");
            } else setReload((n) => n + 1);
          },
          (e) => {
            if (!cancelled) {
              setError(message(e));
              setSyncStatus("error");
            }
          },
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setError(message(e));
          setSyncStatus("error");
        }
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid, scope, entry.ready]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (ref.current.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const update = useCallback(
    (updater: (state: DemoState) => DemoState) => {
      const current = ref.current;
      if (!current.ready || current.scope !== scopeRef.current)
        throw new Error("Load your workspace before making changes.");
      const state = updater(current.state);
      validateWorkspace(state);
      const next = { ...current, state, dirty: Boolean(uid) };
      try {
        backup(next);
      } catch {
        setError(
          "Browser storage is full or unavailable. Export data and free storage before editing.",
        );
        throw new Error(
          "Could not preserve these edits. Browser storage is unavailable.",
        );
      }
      publish(next);
      if (!uid) setSyncStatus("saved");
    },
    [uid, backup, publish],
  );
  const addSubject = (subject: Subject) =>
    update((s) => ({ ...s, subjects: [...s.subjects, subject] }));
  const updateSubject = (id: string, patch: Partial<Subject>) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.map((v) =>
        v.id === id ? { ...v, ...patch, id } : v,
      ),
    }));
  const deleteSubject = (id: string) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.filter((v) => v.id !== id),
      sessions: s.sessions.filter(
        (v) => v.subjectId !== id || v.status === "completed",
      ),
    }));
  const addTopic = (subjectId: string, topic: Topic) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.map((v) =>
        v.id === subjectId ? { ...v, topics: [...v.topics, topic] } : v,
      ),
    }));
  const updateTopic = (subjectId: string, id: string, patch: Partial<Topic>) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.map((v) =>
        v.id === subjectId
          ? {
              ...v,
              topics: v.topics.map((t) =>
                t.id === id ? { ...t, ...patch, id } : t,
              ),
            }
          : v,
      ),
    }));
  const deleteTopic = (subjectId: string, id: string) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.map((v) =>
        v.id === subjectId
          ? { ...v, topics: v.topics.filter((t) => t.id !== id) }
          : v,
      ),
      sessions: s.sessions.filter(
        (v) =>
          v.subjectId !== subjectId ||
          v.topicId !== id ||
          v.status === "completed",
      ),
    }));
  const checkOverlap = (state: DemoState, session: StudySession) => {
    if (state.sessions.some((s) => sessionsOverlap(s, session)))
      throw new Error(
        "This session overlaps another planned session. Choose another time.",
      );
  };
  const addSession = (session: StudySession) =>
    update((s) => {
      checkOverlap(s, session);
      return applySessionChange(s, undefined, session);
    });
  const updateSession = (id: string, patch: Partial<StudySession>) =>
    update((s) => {
      const old = s.sessions.find((v) => v.id === id);
      if (!old) throw new Error("Session no longer exists.");
      const next = { ...old, ...patch, id };
      checkOverlap(s, next);
      return applySessionChange(s, old, next);
    });
  const deleteSession = (id: string) =>
    update((s) =>
      applySessionChange(
        s,
        s.sessions.find((v) => v.id === id),
        undefined,
      ),
    );
  const savePreferences = (patch: Partial<Preferences>) =>
    update((s) => ({
      ...s,
      preferences: { ...s.preferences, ...patch, theme: "dark" },
    }));
  const plan = useMemo(
    () =>
      buildPlan(
        entry.state.subjects,
        entry.state.preferences,
        entry.state.sessions,
      ),
    [entry.state.subjects, entry.state.preferences, entry.state.sessions],
  );
  const regeneratePlan = () =>
    update((s) => ({
      ...s,
      sessions: [
        ...s.sessions.filter((v) => v.status === "completed"),
        ...buildPlan(s.subjects, s.preferences, s.sessions).sessions,
      ],
    }));
  const resetDemoData = () => {
    if (uid)
      throw new Error("Demo reset is available only in the local workspace.");
    update(() => cloneInitialState());
  };
  const exportData = () => {
    const raw = !ref.current.ready
      ? localStorage.getItem(uid ? `syllabus-ai-backup:${scope}` : LOCAL_KEY)
      : JSON.stringify(ref.current.state, null, 2);
    if (!raw) throw new Error("No local backup is available.");
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "syllabus-ai-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reloadCloud = () => {
    if (uid) localStorage.removeItem(`syllabus-ai-backup:${scope}`);
    else localStorage.removeItem(LOCAL_KEY);
    setReload((n) => n + 1);
  };
  return {
    state: entry.state,
    ready: entry.ready && entry.scope === scope,
    syncStatus,
    error,
    isCloud: Boolean(uid),
    scope,
    dirty: entry.dirty,
    addSubject,
    updateSubject,
    deleteSubject,
    addTopic,
    updateTopic,
    deleteTopic,
    addSession,
    updateSession,
    deleteSession,
    savePreferences,
    resetDemoData,
    setTopicStatus: (sid: string, tid: string, status: TopicStatus) =>
      updateTopic(sid, tid, {
        status,
        revisionStatus:
          status === "Complete"
            ? "Ready"
            : status === "In progress"
              ? "Review"
              : "New",
      }),
    setSessionStatus: (id: string, status: SessionStatus) =>
      updateSession(id, { status }),
    replaceSubjects: (subjects: Subject[]) =>
      update((s) => ({ ...s, subjects, onboardingComplete: true })),
    markOnboardingComplete: () =>
      update((s) => ({ ...s, onboardingComplete: true })),
    completeOnboarding: (
      subjects: Subject[],
      patch: Partial<Preferences>,
      preview?: StudySession[],
    ) =>
      update((s) => {
        const preferences = { ...s.preferences, ...patch };
        return {
          ...s,
          subjects,
          preferences,
          sessions: preview ?? buildPlan(subjects, preferences).sessions,
          studyLog: [],
          onboardingComplete: true,
        };
      }),
    regeneratePlan,
    unscheduled: plan.unscheduled,
    flushSave,
    retrySave: () => {
      setError("");
      setSyncStatus("idle");
      void flushSave();
    },
    retryLoad: () => setReload((n) => n + 1),
    exportData,
    reloadCloud,
  };
}
export type DemoActions = ReturnType<typeof useDemoState>;
