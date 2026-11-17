import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Settings,
  LogOut,
  Zap,
  Bell,
  Search,
  Menu,
  ChevronRight,
  Command,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab, searchQuery, setSearchQuery }: LayoutProps) {
  const user = auth.currentUser;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'syllabi', label: 'My Syllabi', icon: BookOpen },
    { id: 'planner', label: 'Study Planner', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app-shell workspace-shell flex h-screen text-white font-sans overflow-hidden selection:bg-purple-500/30">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a2a] via-[#020205] to-[#020205] -z-10" />
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] -z-10 animate-pulse" />

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 252 : 84 }}
        className="fixed left-4 top-4 bottom-4 z-50 backdrop-blur-2xl border rounded-[24px] flex flex-col overflow-hidden sidebar-shell workspace-sidebar"
      >
        <div className="p-5 flex items-center justify-center gap-3">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="logo-mark w-11 h-11 rounded-[14px] flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0"
          >
            <Zap className="w-6 h-6 text-white fill-white/20" />
          </motion.div>
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                 className="flex flex-col sidebar-brand"
              >
                  <span className="text-[15px] font-bold tracking-tight leading-none text-white">
                   Syllabus<span className="text-violet-300">AI</span>
                  </span>
                 <span className="text-[9px] uppercase tracking-[.2em] text-white/35 font-bold mt-1">Study OS</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-3 py-8 space-y-2">
          {isSidebarOpen && <p className="eyebrow px-3 mb-3">Workspace</p>}
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(item.id)}
                 className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group ${
                  isActive ? 'text-white' : 'text-white/40 hover:text-white/80'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                     className="absolute inset-0 bg-violet-400/[.11] border border-violet-300/[.12] rounded-xl -z-10 shadow-inner"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                 <div className={`p-2 rounded-lg transition-all duration-300 ${
                   isActive ? 'bg-violet-400/20 text-violet-100 shadow-lg shadow-violet-500/10' : 'bg-white/5 text-white/40 group-hover:text-white/60'
                }`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <AnimatePresence>
                  {isSidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                       className="text-sm font-semibold tracking-tight sidebar-label"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && isSidebarOpen && (
                  <motion.div
                    layoutId="active-dot"
                     className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(168,155,255,.9)]"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        <div className="p-3 mt-auto space-y-1 border-t border-white/5">
          <Button
            variant="ghost"
             className="w-full h-11 rounded-xl justify-start gap-3 text-white/40 hover:text-white hover:bg-white/5 transition-all"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <Menu className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
             {isSidebarOpen && <span className="text-sm font-semibold collapse-label">Collapse</span>}
          </Button>
           <Button
             variant="ghost"
             className="w-full h-11 rounded-xl justify-start gap-3 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
            onClick={() => signOut(auth)}
          >
            <LogOut className="w-5 h-5" />
             {isSidebarOpen && <span className="text-sm font-semibold collapse-label">Logout</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-500 ${isSidebarOpen ? 'pl-[272px]' : 'pl-[104px]'} app-main`}>
        {/* Top Navbar */}
        <header className={`fixed top-4 right-4 z-40 transition-all duration-500 ${
           isSidebarOpen ? 'left-[272px]' : 'left-[104px]'
         }`}>
           <div className={`mx-auto px-6 flex items-center justify-between rounded-2xl border transition-all duration-500 workspace-header ${
             isScrolled ? 'backdrop-blur-2xl py-3 shadow-2xl' : 'bg-transparent py-4 border-transparent'
           }`}>
             <div className="hidden lg:flex items-center gap-3 mr-6 min-w-[170px]">
               <div className="w-8 h-8 rounded-lg bg-white/[.05] border border-white/[.08] flex items-center justify-center">
                 <Command className="w-4 h-4 text-violet-200/70" />
               </div>
               <div>
                 <p className="text-[10px] uppercase tracking-[.16em] text-white/30 font-bold">Workspace</p>
                 <p className="text-xs font-semibold text-white/70">{navItems.find(item => item.id === activeTab)?.label}</p>
               </div>
             </div>
             <div className="relative group max-w-sm w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-purple-400 transition-colors" />
              <Input
                placeholder="Search syllabi or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full h-10 bg-white/[.045] border-white/[.07] rounded-xl pl-11 pr-4 focus:bg-white/[.08] focus:border-violet-400/30 transition-all placeholder:text-white/20 text-sm"
              />
            </div>

            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                 aria-label="Open notifications"
                 className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center relative transition-all"
              >
                <Bell className="w-5 h-5 text-white/60" />
                <span className="absolute top-3 right-3 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
              </motion.button>

              <div className="h-8 w-[1px] bg-white/10 mx-2" />

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold tracking-tight">{user?.displayName || 'Study Master'}</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Premium Plus</p>
                  </div>
                </div>
                 <Avatar className="w-10 h-10 border border-white/10 shadow-xl ring-2 ring-purple-500/20">
                  <AvatarImage src={user?.photoURL || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                    {user?.displayName?.[0] || 'S'}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <section className="flex-1 overflow-y-auto custom-scrollbar pt-32 px-10 pb-10 app-scroll-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-6xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
