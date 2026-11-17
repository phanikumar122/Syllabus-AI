import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { db } from "../lib/cloudFirebase";
import {
  decodeWorkspace,
  emptyWorkspace,
  validateWorkspace,
} from "../domain/workspace";
import type { DemoState, Subject, Topic } from "../types";

export const CHUNK_SIZE = 100_000;
export function encodeChunks(state: DemoState) {
  validateWorkspace(state);
  const json = JSON.stringify(state);
  return Array.from({ length: Math.ceil(json.length / CHUNK_SIZE) }, (_, i) =>
    json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
  );
}
export function decodeChunks(chunks: string[]): DemoState {
  return decodeWorkspace(JSON.parse(chunks.join("")));
}
const manifest = (uid: string, database: Firestore = db) =>
  doc(database, "users", uid, "workspaces", "main");
export async function loadWorkspace(
  uid: string,
  database: Firestore = db,
): Promise<{ state: DemoState; revision: number }> {
  const result = await runTransaction(database, async (tx) => {
    const ref = manifest(uid, database),
      snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.schemaVersion === 1)
      return { state: decodeWorkspace(data.state), revision: 0 };
    if (
      data.schemaVersion !== 2 ||
      !Number.isInteger(data.revision) ||
      !Number.isInteger(data.chunkCount) ||
      data.chunkCount < 1 ||
      data.chunkCount > 80
    )
      throw new Error(
        "Cloud workspace metadata is invalid. Export your backup before recovery.",
      );
    const chunks: string[] = [];
    for (let i = 0; i < data.chunkCount; i++) {
      const chunk = await tx.get(doc(ref, "chunks", String(i)));
      if (!chunk.exists() || typeof chunk.data().payload !== "string")
        throw new Error(
          "Cloud workspace is incomplete. Your local backup is retained.",
        );
      chunks.push(chunk.data().payload);
    }
    return { state: decodeChunks(chunks), revision: data.revision as number };
  });
  return (
    result ?? { state: await importLegacyWorkspace(uid, database), revision: 0 }
  );
}
export async function saveWorkspace(
  uid: string,
  state: DemoState,
  revision: number,
  database: Firestore = db,
): Promise<number> {
  const chunks = encodeChunks(state);
  return runTransaction(database, async (tx) => {
    const ref = manifest(uid, database),
      snap = await tx.get(ref),
      data = snap.data();
    const current = data?.schemaVersion === 2 ? data.revision : 0;
    if (current !== revision)
      throw new Error(
        "Another tab or device changed this workspace. Export your edits, then reload cloud data before continuing.",
      );
    chunks.forEach((payload, i) =>
      tx.set(doc(ref, "chunks", String(i)), { payload }),
    );
    const oldCount =
      data?.schemaVersion === 2 ? Math.min(80, data.chunkCount) : 0;
    for (let i = chunks.length; i < oldCount; i++)
      tx.delete(doc(ref, "chunks", String(i)));
    tx.set(ref, {
      schemaVersion: 2,
      revision: revision + 1,
      chunkCount: chunks.length,
      updatedAt: serverTimestamp(),
    });
    return revision + 1;
  });
}
export function observeWorkspace(
  uid: string,
  callback: (revision: number) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    manifest(uid),
    (snap) => {
      if (!snap.metadata.hasPendingWrites) callback(snap.data()?.revision ?? 0);
    },
    onError,
  );
}

// Read the previous product model once; keep its documents for recovery.
async function importLegacyWorkspace(
  uid: string,
  database: Firestore,
): Promise<DemoState> {
  const state = emptyWorkspace();
  const syllabi = await getDocs(collection(database, "users", uid, "syllabi"));
  for (const syllabus of syllabi.docs) {
    const data = syllabus.data();
    const [topics, progress] = await Promise.all([
      getDocs(collection(syllabus.ref, "topics")),
      getDocs(collection(syllabus.ref, "progress")),
    ]);
    const completed = new Set(
      progress.docs
        .filter((p) => p.data().status === "Completed")
        .map((p) => p.data().topicId ?? p.id),
    );
    const subject: Subject = {
      id: syllabus.id,
      name: data.name,
      examDate: data.examDate,
      color: "#8b7aff",
      difficulty: "Medium",
      topics: topics.docs.map((t) => {
        const v = t.data(),
          done = completed.has(t.id);
        return {
          id: t.id,
          title: v.title,
          chapter: v.subject || "Imported syllabus",
          minutes: Math.max(10, Math.round(v.estimatedHours * 60)),
          priority:
            v.difficulty === "Hard"
              ? "High"
              : v.difficulty === "Easy"
                ? "Low"
                : "Medium",
          status: done ? "Complete" : "Not started",
          revisionStatus: done ? "Ready" : "New",
          notes: "",
        } as Topic;
      }),
    };
    state.subjects.push(subject);
    if (typeof data.dailyHours === "number")
      state.preferences.dailyGoal = data.dailyHours;
  }
  state.onboardingComplete = state.subjects.length > 0;
  validateWorkspace(state);
  return state;
}
