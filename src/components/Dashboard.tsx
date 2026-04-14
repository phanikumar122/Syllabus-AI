import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  Target,
  ChevronRight,
  Zap,
  BookOpen,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ArrowUpRight,
  Upload,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { auth } from '../lib/firebase';
import {
  subscribeSyllabi,
  subscribeTopics,
  subscribeProgress,
  type SyllabusData,
  type TopicData,
  type ProgressData,
} from '../services/firestoreService';
import { getSmartNudge } from '../services/geminiService';
import { differenceInDays } from 'date-fns';

// Static chart data (represents past study hours)
const chartData = [
  { name: 'Mon', hours: 2.5 },
  { name: 'Tue', hours: 4.2 },
  { name: 'Wed', hours: 3.8 },
  { name: 'Thu', hours: 5.1 },
  { name: 'Fri', hours: 4.5 },
  { name: 'Sat', hours: 6.2 },
  { name: 'Sun', hours: 4.8 },
];

interface DashboardProps {
  onNavigate: (tab: string) => void;
  searchQuery?: string;
}

export default function Dashboard({ onNavigate, searchQuery = '' }: DashboardProps) {
  const [syllabi, setSyllabi] = useState<SyllabusData[]>([]);
  const [activeSyllabus, setActiveSyllabus] = useState<SyllabusData | null>(null);
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [nudge, setNudge] = useState<string>('Analyzing your focus zones...');
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;

  // ── Subscribe to syllabi ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const unsub = subscribeSyllabi(user.uid, (data) => {
      setSyllabi(data);
      if (data.length > 0) {
        setActiveSyllabus(prev => prev ?? data[0]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // ── Subscribe to topics & progress for active syllabus ────────────────────
  useEffect(() => {
    if (!user || !activeSyllabus) return;

    const unsubTopics = subscribeTopics(user.uid, activeSyllabus.id, setTopics);
    const unsubProgress = subscribeProgress(user.uid, activeSyllabus.id, setProgress);

    return () => {
      unsubTopics();
      unsubProgress();
    };
  }, [user, activeSyllabus?.id]);

  // ── Fetch AI nudge (debounced — only when counts change) ──────────────────
  const fetchNudge = useCallback(async () => {
    if (!activeSyllabus || topics.length === 0) return;

    const completedCount = progress.filter(p => p.status === 'Completed').length;
    const progressPercent = Math.round((completedCount / topics.length) * 100);
    const daysLeft = differenceInDays(new Date(activeSyllabus.examDate), new Date());

    try {
      const msg = await getSmartNudge(progressPercent, daysLeft, topics.length - completedCount);
      setNudge(msg);
    } catch {
      // Keep current nudge on error
    }
  }, [activeSyllabus, topics.length, progress.length]);  // Only re-run when counts change

  useEffect(() => {
    fetchNudge();
  }, [fetchNudge]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const completedCount = progress.filter(p => p.status === 'Completed').length;
  const progressPercent = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;
  const daysLeft = activeSyllabus
    ? Math.max(0, differenceInDays(new Date(activeSyllabus.examDate), new Date()))
    : 0;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-8 pb-20">
        <div className="h-14 w-64 skeleton rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-48 skeleton rounded-[2.5rem]" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 h-96 skeleton rounded-[3rem]" />
          <div className="h-96 skeleton rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (syllabi.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6"
      >
        <div className="w-24 h-24 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 flex items-center justify-center mb-8 shadow-2xl">
          <Target className="w-10 h-10 text-purple-400" />
        </div>
        <h2 className="text-4xl font-bold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-white/40">
          No Syllabus Found
        </h2>
        <p className="text-white/40 mb-10 max-w-md font-medium leading-relaxed">
          Unlock your potential by uploading a syllabus. Our AI will break it down into actionable study blocks.
        </p>
        {/* FIX: was a dead button with no onClick */}
        <Button
          onClick={() => onNavigate('upload')}
          className="h-14 px-10 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] transition-all flex items-center gap-3"
        >
          <Upload className="w-5 h-5" />
          Upload Your First Syllabus
        </Button>
      </motion.div>
    );
  }

  const stats = [
    {
      title: 'Current Progress',
      value: `${progressPercent}%`,
      icon: TrendingUp,
      sub: `${completedCount} of ${topics.length} topics mastered`,
      color: 'blue',
      progress: progressPercent,
    },
    {
      title: 'Days Remaining',
      value: daysLeft,
      icon: Clock,
      sub: 'Time until exam milestone',
      color: 'purple',
    },
    {
      title: 'Study Velocity',
      value: `${activeSyllabus?.dailyHours ?? 0}h/day`,
      icon: Zap,
      sub: 'Calculated optimal pace',
      color: 'cyan',
    },
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="space-y-3">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/40"
          >
            Dashboard
          </motion.h1>
          <div className="flex items-center gap-4">
            <p className="text-white/40 font-semibold text-sm uppercase tracking-widest">Active Focus:</p>
            <DropdownMenu>
              <DropdownMenuTrigger className="h-auto p-0 text-lg font-bold hover:bg-transparent flex items-center gap-3 group border-none cursor-pointer bg-transparent">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 border-b border-purple-500/20 group-hover:border-purple-500/50 transition-all pb-0.5">
                  {activeSyllabus?.name ?? 'Select Syllabus'}
                </span>
                <div className="p-1 rounded-lg bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
                  <ChevronDown className="w-4 h-4 text-white/40 group-hover:text-white" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#0f0f13]/90 backdrop-blur-2xl border-white/5 rounded-2xl p-2 min-w-[280px] shadow-2xl z-50">
                {syllabi.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setActiveSyllabus(s)}
                    className="rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 flex items-center gap-3 transition-all mb-1 last:mb-0"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className={`text-sm ${activeSyllabus?.id === s.id ? 'font-bold text-white' : 'text-white/40 font-medium'}`}>
                      {s.name}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* AI Nudge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -4 }}
          className="flex items-center gap-4 bg-white/5 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/10 shadow-xl max-w-md"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80">AI Insight</span>
            <span className="text-sm font-semibold text-white/90 leading-snug">{nudge}</span>
          </div>
        </motion.div>
      </header>

      {/* ── Stats Grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          >
            <Card className="glass-card border-none p-1 bg-white/5 hover:bg-white/[0.08] transition-all rounded-[2.5rem] group relative overflow-hidden h-full">
              <div className="p-7 space-y-6">
                <div className="flex items-center justify-between">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br border flex items-center justify-center shadow-inner ${
                    stat.color === 'blue' ? 'from-blue-600/20 to-cyan-600/20 border-blue-500/20' :
                    stat.color === 'purple' ? 'from-purple-600/20 to-pink-600/20 border-purple-500/20' :
                    'from-cyan-600/20 to-teal-600/20 border-cyan-500/20'
                  }`}>
                    <stat.icon className={`w-6 h-6 ${
                      stat.color === 'blue' ? 'text-blue-400' :
                      stat.color === 'purple' ? 'text-purple-400' :
                      'text-cyan-400'
                    }`} />
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/30">
                    Live
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold tracking-tighter text-white">{stat.value}</span>
                    <ArrowUpRight className="w-5 h-5 text-green-400/50 -translate-y-2" />
                  </div>
                  <p className="text-sm font-bold text-white/40 uppercase tracking-widest">{stat.title}</p>
                </div>

                {stat.progress !== undefined ? (
                  <div className="space-y-4">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stat.progress}%` }}
                        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-glow-purple"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-white/20">{stat.sub}</span>
                      <span className="text-[10px] font-bold text-white/40">{stat.progress}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-2">
                    <TrendingUp className="w-4 h-4 text-green-400/40" />
                    <p className="text-xs text-white/40 font-medium">{stat.sub}</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Chart + Topics ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="xl:col-span-2"
        >
          <Card className="glass-card border-none p-10 bg-white/5 rounded-[3rem] h-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
              <div className="space-y-2">
                <h3 className="text-3xl font-bold tracking-tight">Focus Trends</h3>
                <p className="text-sm text-white/40 font-medium">Study hours over the last 7 sessions</p>
              </div>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-2xl">
                <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/80 bg-white/5 border border-white/10">Hours</Button>
                <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white">Topics</Button>
              </div>
            </div>

            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff20', fontSize: 13, fontWeight: 700 }} dy={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#ffffff20', fontSize: 13, fontWeight: 700 }} />
                  <Tooltip
                    cursor={{ stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '4 4' }}
                    contentStyle={{
                      backgroundColor: 'rgba(15,15,20,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '24px',
                      backdropFilter: 'blur(20px)',
                      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                      padding: '16px 20px',
                    }}
                    itemStyle={{ color: '#fff', fontWeight: 800, fontSize: '14px' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px' }}
                  />
                  <Area type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#chartGradient)" animationDuration={2500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Topics sidebar */}
        <div className="space-y-6">
          <Card className="glass-card border-none p-8 bg-white/5 rounded-[2.5rem] shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold tracking-tight">Critical Topics</h3>
              <button
                onClick={() => onNavigate('planner')}
                className="p-2 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white/30" />
              </button>
            </div>
            <div className="space-y-4">
              {topics
                .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .slice(0, 4)
                .map((topic) => {
                const topicProgress = progress.find(p => p.topicId === topic.id);
                const isCompleted = topicProgress?.status === 'Completed';

                return (
                  <motion.div
                    key={topic.id}
                    whileHover={{ scale: 1.02, x: 4 }}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-purple-500/20 hover:bg-white/[0.06] transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all shadow-inner ${
                        isCompleted ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white/20'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <BookOpen className="w-4 h-4 opacity-40" />}
                      </div>
                      <div>
                        <p className={`text-sm font-bold tracking-tight ${isCompleted ? 'text-white/20 line-through' : 'text-white/90'}`}>
                          {topic.title}
                        </p>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 inline-block ${
                          topic.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400' :
                          topic.difficulty === 'Medium' ? 'bg-orange-500/10 text-orange-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>
                          {topic.difficulty}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {topics.length === 0 && (
                <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                  <p className="text-white/10 font-bold uppercase tracking-widest text-xs">No topics yet</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="glass-card border-none p-8 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-blue-500/10 blur-[60px] group-hover:bg-blue-500/20 transition-all duration-700" />
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
              <ActivityIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Study Sprints</h3>
            <p className="text-white/40 text-[13px] font-medium mb-6 leading-relaxed">
              Your focus peaks between <span className="text-white/80">7 PM and 10 PM</span>. Reserve those windows for Hard concepts.
            </p>
            <Button
              onClick={() => onNavigate('planner')}
              className="w-full h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-[10px] uppercase tracking-[0.2em] transition-all"
            >
              Open Planner
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Inline ActivityIcon to avoid lucide version issues
function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
