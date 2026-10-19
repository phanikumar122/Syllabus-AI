import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import SyllabusUpload from './components/SyllabusUpload';
import StudyPlanner from './components/StudyPlanner';
import SyllabiList from './components/SyllabiList';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap, ArrowRight, Play, Check, Orbit, BrainCircuit, Layers3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020205] gap-6">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20"
        >
          <Zap className="w-8 h-8 text-white fill-white/20" />
        </motion.div>
        <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em]">Initializing Engine</p>
      </div>
    );
  }

  // ── Landing / Login page ───────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen w-full bg-[#06070d] text-white overflow-hidden relative selection:bg-violet-500/30">
        <div className="landing-grid absolute inset-0 pointer-events-none" />
        <div className="landing-orb landing-orb-one" />
        <div className="landing-orb landing-orb-two" />

        {/* Top nav */}
        <nav className="relative z-50 max-w-7xl mx-auto px-6 lg:px-10 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="logo-mark w-10 h-10 rounded-2xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white fill-white/20" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white">Syllabus<span className="text-violet-300">AI</span></span>
              <span className="hidden sm:block text-[9px] uppercase tracking-[0.28em] text-white/30 font-bold">The study OS</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-xs font-semibold text-white/45 hover:text-white transition-colors">How it works</a>
            <a href="#about" className="text-xs font-semibold text-white/45 hover:text-white transition-colors">For ambitious learners</a>
            <Button
              onClick={handleLogin}
              variant="ghost"
              className="px-5 h-10 rounded-full bg-white/8 border border-white/12 text-xs font-bold text-white hover:bg-white/15 transition-all"
            >
              Sign In
            </Button>
          </div>
        </nav>

        {/* Hero + 3D product preview */}
        <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-12 lg:pt-20 pb-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-14 items-center">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="text-left">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-violet-400/10 border border-violet-300/20 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200 mb-8"
          >
            <Sparkles className="w-3.5 h-3.5 fill-violet-300" /> Intelligence for your next milestone
          </motion.div>

          <h1 className="text-6xl md:text-8xl font-black tracking-[-0.07em] mb-7 bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/45 leading-[0.92] py-2">
            Your syllabus.<br /><span className="text-gradient-sunset">Decoded.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/48 mb-10 leading-relaxed max-w-xl font-medium tracking-tight">
            Turn overwhelming course material into a calm, intelligent plan that adapts to the way you actually learn.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Button
              size="lg"
              onClick={handleLogin}
              className="h-14 px-7 text-sm font-black rounded-2xl bg-white text-black hover:bg-violet-50 transition-all flex items-center gap-3 shadow-2xl shadow-violet-950/30 hover:-translate-y-0.5"
            >
              Build my study plan <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              className="h-14 px-6 text-sm font-bold rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all flex items-center gap-3"
            >
              <Play className="w-4 h-4 fill-current" /> See the magic
            </Button>
          </div>

          <div className="mt-10 flex items-center gap-3 text-xs text-white/35"><div className="flex -space-x-2">{['A','M','R','K'].map((l,i) => <div key={l} className={`w-7 h-7 rounded-full border-2 border-[#06070d] flex items-center justify-center text-[10px] font-bold ${['bg-amber-200 text-amber-900','bg-sky-200 text-sky-900','bg-rose-200 text-rose-900','bg-emerald-200 text-emerald-900'][i]}`}>{l}</div>)}</div><span>Trusted by focused learners worldwide</span></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: .92, rotateY: 8 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} transition={{ duration: 1.1, delay: .15 }} className="hero-3d-stage">
          <div className="orbit orbit-a" /><div className="orbit orbit-b" />
          <motion.div animate={{ y: [-8, 8, -8], rotate: [-1, 1, -1] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} className="dashboard-preview">
            <div className="preview-top"><div className="flex gap-1.5"><i/><i/><i/></div><span className="text-[9px] text-white/30 font-bold tracking-widest uppercase">Focus / Overview</span><div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-300 to-fuchsia-400"/></div>
            <div className="preview-body"><div className="preview-sidebar"><div className="preview-icon active"><Zap/></div><div className="preview-icon"><Layers3/></div><div className="preview-icon"><BrainCircuit/></div><div className="preview-icon"><Orbit/></div></div><div className="preview-content"><div className="flex justify-between items-start"><div><p className="text-[10px] uppercase tracking-[.2em] text-white/30 font-bold">Good morning, Alex</p><h3 className="text-2xl font-black tracking-tight mt-1">Your learning orbit</h3></div><div className="px-3 py-1.5 rounded-full bg-emerald-400/10 text-emerald-300 text-[9px] font-bold">ON TRACK</div></div><div className="preview-stats"><div><span>Progress</span><strong>68%</strong><div className="mini-progress"><b/></div></div><div><span>Study streak</span><strong>12 days</strong><small>+3 this week</small></div><div><span>Next up</span><strong>Biology</strong><small>45 min session</small></div></div><div className="preview-chart"><div className="chart-label"><span>Momentum</span><span className="text-violet-300">+24.8%</span></div><svg viewBox="0 0 500 120" preserveAspectRatio="none"><defs><linearGradient id="heroChart" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a78bfa" stopOpacity=".35"/><stop offset="1" stopColor="#a78bfa" stopOpacity="0"/></linearGradient></defs><path d="M0 98 C55 90 62 65 112 75 S175 99 220 57 S282 78 322 46 S385 55 430 25 S468 34 500 8 V120 H0Z" fill="url(#heroChart)"/><path d="M0 98 C55 90 62 65 112 75 S175 99 220 57 S282 78 322 46 S385 55 430 25 S468 34 500 8" fill="none" stroke="#c4b5fd" strokeWidth="3"/></svg></div></div></div>
            <div className="preview-float float-one"><div className="float-check"><Check/></div><div><b>Deep work complete</b><span>+18 focus points</span></div></div><div className="preview-float float-two"><span className="w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]"/><span>AI is adapting your plan</span></div>
          </motion.div>
        </motion.div>
        </main>
      </div>
    );
  }

  // ── Main app (authenticated) ───────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} searchQuery={searchQuery} />;
      case 'syllabi':
        return (
          <SyllabiList
            onUploadClick={() => setActiveTab('upload')}
            onSelect={() => setActiveTab('planner')}
            searchQuery={searchQuery}
          />
        );
      case 'upload':
        return (
          <SyllabusUpload
            onComplete={() => setActiveTab('syllabi')}
          />
        );
      case 'planner':
        return <StudyPlanner onNavigate={setActiveTab} searchQuery={searchQuery} />;
      case 'settings':
        return (
          <div className="max-w-4xl mx-auto py-12 space-y-12">
            <header className="space-y-3">
              <h1 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-white/40">Settings</h1>
              <p className="text-white/40 font-semibold text-sm uppercase tracking-[0.2em]">Engine Calibration</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="col-span-1 space-y-2">
                <nav className="flex flex-col gap-2">
                  <button className="text-left px-5 py-3 rounded-2xl bg-white/10 border border-white/10 text-white font-bold text-sm transition-all shadow-inner">
                    Account Parameters
                  </button>
                  <button disabled className="text-left px-5 py-3 rounded-2xl text-white/30 font-bold text-sm cursor-not-allowed">
                    Notifications (Soon)
                  </button>
                  <button disabled className="text-left px-5 py-3 rounded-2xl text-white/30 font-bold text-sm cursor-not-allowed">
                    Integrations (Soon)
                  </button>
                </nav>
              </div>

              <div className="md:col-span-2 space-y-8">
                <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 shadow-2xl glass-card relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px]" />
                  <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    Profile Details
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-black text-xl">
                        {user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-white font-bold">{user.displayName || 'Syllabus User'}</p>
                        <p className="text-white/40 text-sm font-medium">{user.email}</p>
                      </div>
                      <div className="ml-auto px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest">
                        Active Pro
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-red-500/[0.02] border border-red-500/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 blur-[80px]" />
                  <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-red-500">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    </div>
                    Danger Zone
                  </h3>
                  <p className="text-white/40 text-sm font-medium mb-6">
                    Permanently purge your account and all associated syllabus telemetry. This action cannot be reversed.
                  </p>
                  <Button variant="destructive" className="h-12 px-6 rounded-xl font-bold text-sm">
                    Purge Account Data
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      searchQuery={searchQuery} 
      setSearchQuery={setSearchQuery}
    >
      {renderContent()}
    </Layout>
  );
}
