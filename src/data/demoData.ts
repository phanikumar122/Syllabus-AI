import type { DemoState, Subject, StudyLog, StudySession, Topic } from '../types';

const dateFromToday = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const DEMO_TODAY = dateFromToday(0);

export const subjectColors = ['#27FB6B', '#B4F8C5', '#D6EC98', '#98B07E', '#F3F7ED', '#75B95D'];

const topic = (
  id: string,
  title: string,
  chapter: string,
  priority: Topic['priority'],
  minutes: number,
  status: Topic['status'],
  notes = '',
  revisionStatus: Topic['revisionStatus'] = status === 'Complete' ? 'Ready' : 'New',
): Topic => ({ id, title, chapter, priority, minutes, status, notes, revisionStatus });

export const initialSubjects: Subject[] = [
  {
    id: 'dsa',
    name: 'Data Structures & Algorithms',
    color: '#27FB6B',
    examDate: dateFromToday(26),
    difficulty: 'Heavy',
    topics: [
      topic('dsa-arrays', 'Arrays & Hash Tables', 'Foundations', 'Medium', 45, 'Complete', 'Review collision strategies and amortized lookup costs.'),
      topic('dsa-trees', 'Trees & Graph Traversal', 'Non-linear structures', 'High', 60, 'In progress', 'Compare BFS and DFS on a weighted graph.'),
      topic('dsa-dp', 'Dynamic Programming Patterns', 'Problem solving', 'High', 75, 'Not started'),
      topic('dsa-sorting', 'Sorting & Searching', 'Foundations', 'Medium', 50, 'Complete'),
      topic('dsa-complexity', 'Complexity Analysis', 'Problem solving', 'Low', 35, 'Complete'),
      topic('dsa-greedy', 'Greedy Algorithms', 'Problem solving', 'Medium', 55, 'Not started'),
    ],
  },
  {
    id: 'os',
    name: 'Operating Systems',
    color: '#B4F8C5',
    examDate: dateFromToday(31),
    difficulty: 'Heavy',
    topics: [
      topic('os-processes', 'Processes & Threads', 'Core concepts', 'High', 55, 'Complete'),
      topic('os-scheduling', 'CPU Scheduling', 'Core concepts', 'High', 50, 'In progress', 'Work through round-robin and priority queue examples.'),
      topic('os-memory', 'Virtual Memory', 'Memory', 'High', 65, 'Not started'),
      topic('os-deadlocks', 'Deadlocks', 'Concurrency', 'Medium', 45, 'Complete'),
      topic('os-files', 'File Systems', 'Storage', 'Medium', 50, 'Not started'),
    ],
  },
  {
    id: 'dbms',
    name: 'Database Management Systems',
    color: '#D6EC98',
    examDate: dateFromToday(38),
    difficulty: 'Medium',
    topics: [
      topic('dbms-models', 'Relational Model', 'Foundations', 'Medium', 40, 'Complete'),
      topic('dbms-sql', 'SQL Query Design', 'Querying', 'High', 55, 'Complete'),
      topic('dbms-normal', 'Normalization', 'Design', 'Medium', 50, 'In progress'),
      topic('dbms-indexes', 'Indexing & Query Plans', 'Performance', 'High', 60, 'Not started'),
      topic('dbms-transactions', 'Transactions & Recovery', 'Reliability', 'Low', 45, 'Not started'),
    ],
  },
  {
    id: 'networks',
    name: 'Computer Networks',
    color: '#98B07E',
    examDate: dateFromToday(44),
    difficulty: 'Medium',
    topics: [
      topic('net-layers', 'OSI & TCP/IP Models', 'Foundations', 'Low', 35, 'Complete'),
      topic('net-routing', 'Routing Protocols', 'Network layer', 'Medium', 55, 'In progress'),
      topic('net-transport', 'Transport Layer', 'Transport layer', 'High', 60, 'Not started'),
      topic('net-security', 'Network Security Basics', 'Applied networking', 'Medium', 40, 'Not started'),
    ],
  },
];

const session = (
  id: string,
  date: string,
  start: string,
  duration: number,
  subjectId: string,
  topicId: string,
  priority: StudySession['priority'],
  status: StudySession['status'] = 'planned',
): StudySession => ({ id, date, start, duration, subjectId, topicId, priority, status });

export const initialSessions: StudySession[] = [
  session('session-1', DEMO_TODAY, '08:30', 45, 'dsa', 'dsa-trees', 'High'),
  session('session-2', DEMO_TODAY, '11:00', 50, 'os', 'os-scheduling', 'High'),
  session('session-3', DEMO_TODAY, '18:30', 40, 'dbms', 'dbms-normal', 'Medium'),
  session('session-4', dateFromToday(1), '09:00', 60, 'os', 'os-memory', 'High'),
  session('session-5', dateFromToday(1), '19:00', 45, 'networks', 'net-routing', 'Medium'),
  session('session-6', dateFromToday(2), '18:00', 55, 'dsa', 'dsa-dp', 'High'),
  session('session-7', dateFromToday(3), '08:00', 50, 'dbms', 'dbms-indexes', 'High'),
  session('session-8', dateFromToday(4), '17:30', 45, 'networks', 'net-transport', 'High'),
  session('session-9', dateFromToday(-2), '10:00', 50, 'dsa', 'dsa-sorting', 'Medium', 'completed'),
  session('session-10', dateFromToday(-3), '18:00', 55, 'os', 'os-processes', 'Medium', 'completed'),
  session('session-11', dateFromToday(-1), '11:00', 45, 'dbms', 'dbms-sql', 'Medium', 'completed'),
];

export const initialStudyLog: StudyLog[] = [
  { date: dateFromToday(-6), hours: 2.4, topics: 2 },
  { date: dateFromToday(-5), hours: 3.1, topics: 3 },
  { date: dateFromToday(-4), hours: 1.8, topics: 1 },
  { date: dateFromToday(-3), hours: 3.8, topics: 3 },
  { date: dateFromToday(-2), hours: 4.4, topics: 4 },
  { date: dateFromToday(-1), hours: 2.9, topics: 2 },
  { date: DEMO_TODAY, hours: 1.6, topics: 1 },
];

export const initialDemoState: DemoState = {
  subjects: initialSubjects,
  sessions: initialSessions,
  studyLog: initialStudyLog,
  preferences: {
    dailyGoal: 2.5,
    studyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    preferredTime: 'Evening',
    notifications: true,
    weeklyDigest: true,
    theme: 'dark',
  },
  onboardingComplete: false,
};

export const cloneInitialState = (): DemoState => JSON.parse(JSON.stringify(initialDemoState)) as DemoState;

export function findSubject(state: DemoState, subjectId: string) {
  return state.subjects.find((subject) => subject.id === subjectId);
}

export function findTopic(state: DemoState, topicId: string) {
  for (const subject of state.subjects) {
    const found = subject.topics.find((topicItem) => topicItem.id === topicId);
    if (found) return { subject, topic: found };
  }
  return undefined;
}

export function formatDateLabel(value: string, format: 'short' | 'long' = 'short') {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', format === 'long'
    ? { month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' }).format(date);
}

export function daysUntil(value: string) {
  const today = new Date(`${DEMO_TODAY}T12:00:00`).getTime();
  const target = new Date(`${value}T12:00:00`).getTime();
  return Math.max(0, Math.ceil((target - today) / 86400000));
}
