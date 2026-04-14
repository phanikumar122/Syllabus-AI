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
  User,
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
    <div className="flex h-screen bg-[#020205] text-white font-sans overflow-hidden selection:bg-purple-500/30">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a2a] via-[#020205] to-[#020205] -z-10" />
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] -z-10 animate-pulse" />

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 100 }}
        className="fixed left-4 top-4 bottom-4 z-50 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col shadow-2xl shadow-black/40 overflow-hidden"
      >
        <div className="p-6 flex items-center justify-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20"
          >
            <Zap className="w-6 h-6 text-white fill-white/20" />
          </motion.div>
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col"
              >
                <span className="text-lg font-bold tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                  Syllabus AI
                </span>
                <span className="text-[10px] uppercase tracking-widest text-purple-400 font-bold">Breakdown Engine</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-3">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(item.id)}
                className={`relative w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 group ${
                  isActive ? 'text-white' : 'text-white/40 hover:text-white/80'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-white/10 rounded-2xl -z-10 shadow-inner"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className={`p-2 rounded-xl transition-all duration-300 ${
                  isActive ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-white/40 group-hover:text-white/60'
                }`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <AnimatePresence>
                  {isSidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-semibold tracking-tight"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && isSidebarOpen && (
                  <motion.div 
                    layoutId="active-dot"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,1)]"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto space-y-2 border-t border-white/5">
          <Button 
            variant="ghost" 
            className="w-full h-12 rounded-2xl justify-start gap-4 text-white/40 hover:text-white hover:bg-white/5 transition-all"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <Menu className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            {isSidebarOpen && <span className="text-sm font-semibold">Collapse</span>}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full h-12 rounded-2xl justify-start gap-4 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
            onClick={() => signOut(auth)}
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="text-sm font-semibold">Logout</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-500 ${isSidebarOpen ? 'pl-[300px]' : 'pl-[120px]'}`}>
        {/* Top Navbar */}
        <header className={`fixed top-4 right-4 z-40 transition-all duration-500 ${
          isSidebarOpen ? 'left-[300px]' : 'left-[120px]'
        }`}>
          <div className={`mx-auto px-8 flex items-center justify-between rounded-3xl border border-white/10 transition-all duration-500 ${
            isScrolled ? 'bg-white/10 backdrop-blur-2xl py-3 shadow-2xl' : 'bg-transparent py-5'
          }`}>
            <div className="relative group max-w-sm w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-purple-400 transition-colors" />
              <Input 
                placeholder="Search syllabi or topics..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-white/5 border-white/5 rounded-2xl pl-12 pr-4 focus:bg-white/10 focus:border-purple-500/30 transition-all placeholder:text-white/20 text-sm"
              />
            </div>

            <div className="flex items-center gap-4">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center relative transition-all"
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
                <Avatar className="w-11 h-11 border border-white/10 shadow-xl ring-2 ring-purple-500/20">
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
        <section className="flex-1 overflow-y-auto custom-scrollbar pt-32 px-10 pb-10">
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
