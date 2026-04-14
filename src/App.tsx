import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import SyllabusUpload from './components/SyllabusUpload';
import StudyPlanner from './components/StudyPlanner';
import SyllabiList from './components/SyllabiList';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap, ArrowRight, Github } from 'lucide-react';
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
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020205] p-6 overflow-hidden relative selection:bg-blue-500/30">
        {/* Ambient gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-ambient-glow pointer-events-none" />
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Top nav */}
        <nav className="absolute top-0 left-0 w-full p-8 flex justify-between items-center z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/20">
              <Zap className="w-5 h-5 text-white fill-white/20" />
            </div>
            <span className="text-lg font-black tracking-tighter text-white">
              Syllabus<span className="text-blue-400">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">Features</a>
            <a href="#about" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">About</a>
            <Button
              onClick={handleLogin}
              variant="ghost"
              className="px-6 h-10 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
            >
              Sign In
            </Button>
          </div>
        </nav>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-center z-10 max-w-5xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-10 shadow-lg shadow-blue-500/5"
          >
            <Sparkles className="w-3.5 h-3.5 fill-blue-400" /> Premium Release v2.0
          </motion.div>

          <h1 className="text-7xl md:text-[9rem] font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/20 leading-[0.85] py-4">
            Decode Your <br /> Curriculum.
          </h1>

          <p className="text-lg md:text-2xl text-white/30 mb-14 leading-relaxed max-w-2xl mx-auto font-medium tracking-tight">
            Stop studying hard. Start studying <span className="text-white">smart</span>.
            Our engine transforms massive syllabi into precision study sequences in seconds.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <Button
              size="lg"
              onClick={handleLogin}
              className="h-20 px-12 text-xl font-black rounded-3xl bg-white text-black hover:bg-zinc-100 transition-all flex items-center gap-4 shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started <ArrowRight className="w-6 h-6" />
            </Button>

            <Button
              variant="ghost"
              className="h-20 px-10 text-lg font-bold rounded-3xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center gap-4"
            >
              <Github className="w-6 h-6" /> View Architecture
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 border-t border-white/5 pt-12"
          >
            {[
              { label: 'Latency', val: '< 2.4s' },
              { label: 'Precision', val: '99.8%' },
              { label: 'Capacity', val: '∞ Topics' },
              { label: 'Security', val: 'AES-256' },
            ].map(stat => (
              <div key={stat.label} className="text-center group">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-2 group-hover:text-blue-400 transition-colors">{stat.label}</p>
                <p className="text-2xl font-black tracking-tight text-white/60">{stat.val}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
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
