import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  Target,
  Zap,
  ChevronDown,
  Activity,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { auth } from '../lib/firebase';
import { 
  subscribeSyllabi, 
  subscribeTopics, 
  subscribeProgress, 
  subscribePlan,
  savePlan,
  toggleTopicProgress,
  SyllabusData,
  TopicData,
  ProgressData
} from '../services/firestoreService';
import { generateStudyPlan, DayPlan } from '../services/plannerService';
import { format, addDays, startOfToday, isSameDay, eachDayOfInterval, parseISO, differenceInDays } from 'date-fns';

interface StudyPlannerProps {
  onNavigate: (tab: string) => void;
  searchQuery?: string;
}

export default function StudyPlanner({ onNavigate, searchQuery = '' }: StudyPlannerProps) {
  const [syllabi, setSyllabi] = useState<SyllabusData[]>([]);
  const [activeSyllabus, setActiveSyllabus] = useState<SyllabusData | null>(null);
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [plan, setPlan] = useState<DayPlan[]>([]);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: startOfToday(),
    end: addDays(startOfToday(), 30) // Show a bit more range
  }), []);

  useEffect(() => {
    if (!user) return;

    return subscribeSyllabi(user.uid, (data) => {
      setSyllabi(data);
      if (data.length > 0 && !activeSyllabus) {
        setActiveSyllabus(data[0]);
      }
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !activeSyllabus) return;

    const unsubTopics = subscribeTopics(user.uid, activeSyllabus.id, setTopics);
    const unsubProgress = subscribeProgress(user.uid, activeSyllabus.id, setProgress);
    const unsubPlan = subscribePlan(user.uid, activeSyllabus.id, setPlan);

    return () => {
      unsubTopics();
      unsubProgress();
      unsubPlan();
    };
  }, [user, activeSyllabus]);

  const handleGeneratePlan = async () => {
    if (!user || !activeSyllabus || topics.length === 0) return;
    setIsGenerating(true);
    try {
      const newPlan = generateStudyPlan(
        topics,
        new Date(activeSyllabus.examDate),
        activeSyllabus.dailyHours
      );
      
      await savePlan(user.uid, activeSyllabus.id, newPlan);
    } catch (e) {
        console.error("Failed to generate plan", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleTopic = async (topicId: string) => {
    if (!user || !activeSyllabus) return;
    await toggleTopicProgress(user.uid, activeSyllabus.id, topicId, progress);
  };

  const currentDayPlan = plan.find(p => isSameDay(parseISO(p.date), selectedDate));
  const todayTopics = topics
    .filter(t => currentDayPlan?.topics.includes(t.id))
    .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Zap className="w-8 h-8 animate-spin text-purple-500" />
      <p className="text-white/20 text-sm font-bold uppercase tracking-widest">Compiling Roadmap</p>
    </div>
  );

  if (syllabi.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6"
      >
        <div className="w-24 h-24 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 flex items-center justify-center mb-8 shadow-2xl">
          <CalendarIcon className="w-10 h-10 text-blue-400" />
        </div>
        <h2 className="text-4xl font-bold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-white/40">
          Plan Not Activated
        </h2>
        <p className="text-white/40 mb-10 max-w-md font-medium leading-relaxed">
          The study planner requires an active syllabus to generate your personalized timeline.
        </p>
        <Button 
          onClick={() => onNavigate('upload')}
          className="h-14 px-10 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all"
        >
          Upload Content
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="space-y-3">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/40"
          >
            Study Planner
          </motion.h1>
          <div className="flex items-center gap-4">
            <p className="text-white/40 font-semibold text-sm uppercase tracking-widest">Active Schedule:</p>
            <DropdownMenu>
              <DropdownMenuTrigger className="h-auto p-0 text-lg font-bold hover:bg-transparent flex items-center gap-3 group border-none cursor-pointer bg-transparent">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 border-b border-purple-500/20 group-hover:border-purple-500/50 transition-all pb-0.5">
                  {activeSyllabus?.name || 'Select Syllabus'}
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

        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl p-2 rounded-3xl border border-white/10 shadow-xl">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-2xl hover:bg-white/5 text-white/40 hover:text-white" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="px-6 font-bold tracking-tight text-xs uppercase tracking-[0.3em] text-white/80">{format(selectedDate, 'MMMM yyyy')}</div>
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-2xl hover:bg-white/5 text-white/40 hover:text-white" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Calendar Strip */}
      <div className="relative group">
        <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar scroll-smooth">
          {calendarDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, startOfToday());
            return (
              <motion.button
                key={day.toString()}
                whileHover={{ y: -4, backgroundColor: isSelected ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.08)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center justify-center min-w-[100px] h-32 rounded-[2rem] transition-all duration-500 border ${
                  isSelected 
                    ? 'bg-white text-black border-white shadow-2xl shadow-white/10' 
                    : 'bg-white/5 text-white/30 border-white/5 hover:border-white/20'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${isSelected ? 'text-black/60' : 'text-white/20'}`}>
                  {format(day, 'EEE')}
                </span>
                <span className="text-3xl font-black tracking-tight">{format(day, 'dd')}</span>
                {isToday && (
                  <motion.div 
                    layoutId="today-indicator"
                    className={`w-1.5 h-1.5 rounded-full mt-3 ${isSelected ? 'bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.8)]' : 'bg-white/40'}`} 
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-tight">Today's Focus</h3>
                <p className="text-sm text-white/40 font-medium">Prioritized sequence based on topic difficulty</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 relative">
            <div className="absolute left-10 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/20 via-blue-500/20 to-transparent" />
            
            {plan.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-24 text-center glass-card rounded-[3rem] border-none bg-white/[0.03] space-y-8"
              >
                <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto border border-white/10">
                  <Sparkles className="w-10 h-10 text-white/20" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold">No High-Performance Roadmap</p>
                  <p className="text-white/30 font-medium max-w-sm mx-auto">Generate a custom schedule optimized for your cognitive load and timeline.</p>
                </div>
                <Button 
                  onClick={handleGeneratePlan}
                  disabled={isGenerating}
                  className="h-14 px-10 rounded-2xl bg-white text-black font-black hover:bg-zinc-100 hover:scale-[1.03] transition-all shadow-2xl"
                >
                  {isGenerating ? "Analyzing Dynamics..." : 'Generate AI Roadmap'}
                </Button>
              </motion.div>
            ) : todayTopics.length > 0 ? (
              <div className="space-y-6">
                {todayTopics.map((topic, i) => {
                  const topicProgress = progress.find(p => p.topicId === topic.id);
                  const isCompleted = topicProgress?.status === 'Completed';
                  
                  return (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`relative flex gap-10 p-8 rounded-[2.5rem] transition-all duration-500 group border h-full ${
                        isCompleted 
                          ? 'bg-gradient-to-br from-green-500/5 to-transparent border-green-500/10' 
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      <div className="relative z-10 scale-[1.2]">
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggleTopic(topic.id)}
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border ${
                            isCompleted 
                              ? 'bg-green-500 text-black border-green-500 shadow-xl shadow-green-500/20' 
                              : 'bg-white/5 text-white/20 border-white/10 group-hover:border-white/30 group-hover:bg-white/10'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="w-7 h-7" /> : <div className="w-2 h-2 rounded-full bg-white/40" />}
                        </motion.button>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className={`text-2xl font-bold tracking-tight transition-all duration-500 ${isCompleted ? 'text-white/20 line-through' : 'text-white'}`}>
                              {topic.title}
                            </h4>
                            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-purple-400/60 transition-all group-hover:text-purple-400">
                              {topic.subject || 'Core Objective'}
                            </p>
                          </div>
                          <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] border shadow-sm ${
                            topic.difficulty === 'Hard' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            topic.difficulty === 'Medium' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                            'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          }`}>
                            {topic.difficulty}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-8 pt-2">
                          <div className="flex items-center gap-2.5 text-xs text-white/40 font-bold group-hover:text-white/60 transition-colors">
                            <Clock className="w-4 h-4 text-purple-500/50" /> {topic.estimatedHours}h SESSION
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-white/40 font-bold group-hover:text-white/60 transition-colors">
                            <BookOpen className="w-4 h-4 text-blue-500/50" /> SUBJECT EXPERTISE
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="py-24 text-center glass-card rounded-[3rem] border-none bg-white/[0.01]">
                <p className="text-white/20 font-bold uppercase tracking-[0.2em] text-xs">No focus zones for this period</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <Card className="glass-card border-none p-10 bg-white/5 rounded-[3rem] space-y-10">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Timeline Engine</h3>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Global progress metrics</p>
            </div>
            
            <div className="space-y-8">
              {[
                { label: 'Projected Topics', value: topics.length, icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Mastery Level', value: progress.filter(p => p.status === 'Completed').length, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'Daily Energy', value: `${activeSyllabus?.dailyHours || 0}h`, icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' }
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between p-5 rounded-[2rem] bg-white/[0.03] border border-white/5 group hover:bg-white/[0.06] transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest leading-tight">{stat.label}</span>
                  </div>
                  <span className="text-2xl font-black tracking-tight text-white">{stat.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="glass-card border-none p-10 bg-gradient-to-br from-purple-600/10 to-transparent rounded-[3rem] relative overflow-hidden group">
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/10 blur-[80px] group-hover:bg-purple-500/20 transition-all duration-1000" />
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-white/5">
              <Target className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-3xl font-black tracking-tighter mb-4">Exam Horizon</h3>
            <p className="text-white/40 text-sm font-medium mb-10 leading-relaxed">
              You are currently <span className="text-white/80 font-bold">{activeSyllabus?.examDate ? differenceInDays(new Date(activeSyllabus.examDate), new Date()) : '??'} days</span> away from your exam. AI suggests increasing velocity by 12% to ensure mastery.
            </p>
            <Button className="w-full h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-[10px] uppercase tracking-widest transition-all">
              Calibrate Flow
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
