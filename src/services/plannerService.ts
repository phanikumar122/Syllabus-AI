import { addDays, differenceInDays, format, isBefore, startOfDay } from 'date-fns';

export interface Topic {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedHours: number;
}

export interface DayPlan {
  date: string;
  topics: string[]; // IDs
  isRevision: boolean;
}

export function generateStudyPlan(
  topics: Topic[],
  examDate: Date,
  dailyHours: number,
  startDate: Date = new Date()
): DayPlan[] {
  const totalDays = differenceInDays(startOfDay(examDate), startOfDay(startDate));
  if (totalDays <= 0) return [];

  // Sort topics: Hard first, then Medium, then Easy
  const difficultyWeight = { Hard: 3, Medium: 2, Easy: 1 };
  const sortedTopics = [...topics].sort((a, b) => difficultyWeight[b.difficulty] - difficultyWeight[a.difficulty]);

  const schedule: DayPlan[] = [];
  let currentTopicIndex = 0;
  
  // Reserve last 15% of days for revision
  const revisionDaysCount = Math.max(1, Math.floor(totalDays * 0.15));
  const studyDaysCount = totalDays - revisionDaysCount;

  for (let i = 0; i < studyDaysCount; i++) {
    const currentDate = addDays(startDate, i);
    const dayTopics: string[] = [];
    let remainingDailyHours = dailyHours;

    while (currentTopicIndex < sortedTopics.length && remainingDailyHours > 0) {
      const topic = sortedTopics[currentTopicIndex];
      // Simple logic: if topic fits or is the only one left, assign it
      // In a real app, we might split topics across days, but for simplicity we assign whole topics
      dayTopics.push(topic.id);
      remainingDailyHours -= topic.estimatedHours;
      currentTopicIndex++;
    }

    schedule.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      topics: dayTopics,
      isRevision: false
    });
  }

  // Add revision days
  for (let i = 0; i < revisionDaysCount; i++) {
    const currentDate = addDays(startDate, studyDaysCount + i);
    schedule.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      topics: [], // Revision covers all previous topics
      isRevision: true
    });
  }

  return schedule;
}
