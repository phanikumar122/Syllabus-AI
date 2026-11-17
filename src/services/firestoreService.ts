/**
 * firestoreService.ts
 *
 * Centralized Firestore data access layer.
 * All components must use these functions — no direct Firestore calls in UI.
 *
 * Data Model:
 *   users/{uid}/syllabi/{syllabusId}
 *   users/{uid}/syllabi/{syllabusId}/topics/{topicId}
 *   users/{uid}/syllabi/{syllabusId}/progress/{topicId}
 *   users/{uid}/syllabi/{syllabusId}/plans/main
 */

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  writeBatch,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type Unsubscribe,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/cloudFirebase';
import type { DayPlan } from './plannerService';
import type { ExtractedTopic } from './geminiService';

// ─── Path Helpers ────────────────────────────────────────────────────────────

const syllabiPath = (uid: string) => `users/${uid}/syllabi`;
const topicsPath = (uid: string, sid: string) => `users/${uid}/syllabi/${sid}/topics`;
const progressPath = (uid: string, sid: string) => `users/${uid}/syllabi/${sid}/progress`;
const plansPath = (uid: string, sid: string) => `users/${uid}/syllabi/${sid}/plans`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyllabusData {
  id: string;
  name: string;
  examDate: string;
  dailyHours: number;
  status: string;
  createdAt: any;
}

export interface TopicData {
  id: string;
  title: string;
  subject?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedHours: number;
  createdAt?: any;
}

export interface ProgressData {
  id: string;
  topicId: string;
  status: 'Not Started' | 'Completed';
  completedAt: any;
}

// ─── Syllabi ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to all syllabi for a user, ordered by creation date descending.
 * Returns an unsubscribe function.
 */
export function subscribeSyllabi(
  uid: string,
  callback: (syllabi: SyllabusData[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, syllabiPath(uid)), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as SyllabusData)));
    },
    (err) => {
      console.error('[firestoreService] subscribeSyllabi error:', err);
      onError?.(err);
    }
  );
}

/**
 * Create a new syllabus document and add all its topics in parallel.
 * Returns the new syllabus document ID.
 */
export async function createSyllabus(
  uid: string,
  data: { name: string; examDate: string; dailyHours: number },
  topics: ExtractedTopic[]
): Promise<string> {
  if(!data.name.trim()||data.name.length>160||!/^\d{4}-\d{2}-\d{2}$/.test(data.examDate)||data.dailyHours<.5||data.dailyHours>12||topics.length>200)throw new Error('Invalid syllabus input.');
  const syllabusRef=doc(collection(db,syllabiPath(uid)));
  const batch=writeBatch(db);
  batch.set(syllabusRef,{...data,status:'Active',createdAt:serverTimestamp()});
  topics.forEach(topic=>{
    if(!topic.title.trim()||topic.title.length>200||!Number.isFinite(topic.estimatedHours)||topic.estimatedHours<1/6||topic.estimatedHours>24)throw new Error('Invalid topic effort.');
    batch.set(doc(collection(db,topicsPath(uid,syllabusRef.id))),{...topic,createdAt:serverTimestamp()});
  });
  await batch.commit();return syllabusRef.id;
}

/** Remove the known legacy subcollections before their parent document. */
export async function deleteSyllabus(uid:string,syllabusId:string):Promise<void>{
  for(const path of [topicsPath(uid,syllabusId),progressPath(uid,syllabusId),plansPath(uid,syllabusId)]){
    const records=await getDocs(collection(db,path));
    for(let i=0;i<records.docs.length;i+=450){const batch=writeBatch(db);records.docs.slice(i,i+450).forEach(d=>batch.delete(d.ref));await batch.commit();}
  }
  await deleteDoc(doc(db,syllabiPath(uid),syllabusId));
}
// ─── Topics ──────────────────────────────────────────────────────────────────

/**
 * Subscribe to all topics for a specific syllabus.
 */
export function subscribeTopics(
  uid: string,
  syllabusId: string,
  callback: (topics: TopicData[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, topicsPath(uid, syllabusId)),
    (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as TopicData)));
    },
    (err) => {
      console.error('[firestoreService] subscribeTopics error:', err);
      onError?.(err);
    }
  );
}

// ─── Progress ────────────────────────────────────────────────────────────────

/**
 * Subscribe to all progress entries for a syllabus.
 */
export function subscribeProgress(
  uid: string,
  syllabusId: string,
  callback: (progress: ProgressData[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, progressPath(uid, syllabusId)),
    (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProgressData)));
    },
    (err) => {
      console.error('[firestoreService] subscribeProgress error:', err);
      onError?.(err);
    }
  );
}

/**
 * Toggle a topic between 'Completed' and 'Not Started'.
 */
export async function toggleTopicProgress(
  uid: string,
  syllabusId: string,
  topicId: string,
  currentProgress: ProgressData[]
): Promise<void> {
  const existing = currentProgress.find(p => p.topicId === topicId);
  const newStatus = existing?.status === 'Completed' ? 'Not Started' : 'Completed';

  const progressRef = doc(collection(db, progressPath(uid, syllabusId)), topicId);
  await setDoc(progressRef, {
    topicId,
    status: newStatus,
    completedAt: newStatus === 'Completed' ? serverTimestamp() : null,
  });
}

// ─── Plans ───────────────────────────────────────────────────────────────────

/**
 * Subscribe to the study plan for a syllabus.
 */
export function subscribePlan(
  uid: string,
  syllabusId: string,
  callback: (plan: DayPlan[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, plansPath(uid, syllabusId)),
    (snap) => {
      if (!snap.empty) {
        callback(snap.docs[0].data().schedule as DayPlan[]);
      } else {
        callback([]);
      }
    },
    (err) => {
      console.error('[firestoreService] subscribePlan error:', err);
      onError?.(err);
    }
  );
}

/**
 * Save (overwrite) the study plan.
 */
export async function savePlan(
  uid: string,
  syllabusId: string,
  schedule: DayPlan[]
): Promise<void> {
  const planRef = doc(collection(db, plansPath(uid, syllabusId)), 'main');
  await setDoc(planRef, {
    schedule,
    updatedAt: serverTimestamp(),
  });
}
