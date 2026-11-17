export type Difficulty = 'Light' | 'Medium' | 'Heavy';
export type Priority = 'High' | 'Medium' | 'Low';
export type TopicStatus = 'Not started' | 'In progress' | 'Complete';
export type SessionStatus = 'planned' | 'completed' | 'missed';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Topic {
  id: string;
  title: string;
  chapter: string;
  priority: Priority;
  minutes: number;
  status: TopicStatus;
  notes: string;
  revisionStatus: 'New' | 'Review' | 'Ready';
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  examDate: string;
  difficulty: Difficulty;
  topics: Topic[];
}

export interface StudySession {
  id: string;
  date: string;
  start: string;
  duration: number;
  subjectId: string;
  topicId: string;
  priority: Priority;
  status: SessionStatus;
  note?: string;
}

export interface StudyLog {
  date: string;
  hours: number;
  topics: number;
}

export interface Preferences {
  examType?: 'semester' | 'competitive' | 'personal' | 'other';
  dailyGoal: number;
  studyDays: string[];
  preferredTime: string;
  notifications: boolean;
  weeklyDigest: boolean;
  theme: ThemeMode;
}

export interface DemoState {
  subjects: Subject[];
  sessions: StudySession[];
  studyLog: StudyLog[];
  preferences: Preferences;
  onboardingComplete: boolean;
}

export interface SubjectDraft {
  id: string;
  name: string;
  color: string;
  examDate: string;
  difficulty: Difficulty;
}

export type PageId =
  | 'overview'
  | 'subjects'
  | 'subject'
  | 'planner'
  | 'calendar'
  | 'analytics'
  | 'coach'
  | 'settings';
