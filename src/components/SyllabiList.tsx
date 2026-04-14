import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus,
  MoreVertical,
  Trash2,
  FileText,
  Search,
  Filter,
  Zap,
  ChevronRight,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { auth } from '../lib/firebase';
import { subscribeSyllabi, deleteSyllabus, SyllabusData } from '../services/firestoreService';
import { format } from 'date-fns';

interface SyllabiListProps {
  onUploadClick: () => void;
  onSelect: (syllabus: any) => void;
  searchQuery?: string;
}

function SyllabusCard({ syllabus, i, onSelect, onDelete }: { syllabus: SyllabusData, i: number, onSelect: (s: any) => void, onDelete: (id: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.1 }}
      onClick={() => onSelect(syllabus)}
      className="cursor-pointer group relative"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      <Card className="glass-card border-none h-full relative overflow-hidden rounded-[2.5rem] p-8 space-y-8 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-500">
        <div className="flex justify-between items-start">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:bg-white/10 group-hover:border-white/20 transition-all shadow-inner">
            <FileText className="w-8 h-8 text-blue-400" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger 
              className="w-12 h-12 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer bg-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-5 h-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#0f0f13]/90 backdrop-blur-2xl border-white/5 rounded-2xl p-2 min-w-[180px] shadow-2xl z-[100]">
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(syllabus.id);
                }}
                className="rounded-xl px-4 py-3 cursor-pointer hover:bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest gap-2"
              >
                <Trash2 className="w-4 h-4" /> Decommission
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-3xl font-black tracking-tighter text-white leading-tight">{syllabus.name}</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <Calendar className="w-3.5 h-3.5 text-purple-400/60" />
              {syllabus.examDate ? format(new Date(syllabus.examDate), 'MMM dd, yyyy') : 'No Date'}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <Clock className="w-3.5 h-3.5 text-blue-400/60" />
              {syllabus.dailyHours}h / Day
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-glow-blue animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Active Engine</span>
          </div>
          <div className="flex items-center gap-2 text-white/30 font-black text-[10px] uppercase tracking-[0.2em] group-hover:text-white transition-colors">
            Engage <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function SyllabiList({ onUploadClick, onSelect, searchQuery = '' }: SyllabiListProps) {
  const [syllabi, setSyllabi] = useState<SyllabusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    return subscribeSyllabi(user.uid, (data) => {
      setSyllabi(data);
      setLoading(false);
    });
  }, [user]);

  const handleDelete = async () => {
    if (!user || !deleteId) return;
    setIsDeleting(true);
    try {
        await deleteSyllabus(user.uid, deleteId);
        setDeleteId(null);
    } catch (e) {
        console.error("Failed to delete syllabus", e);
    } finally {
        setIsDeleting(false);
    }
  };

  const filteredSyllabi = syllabi.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Zap className="w-8 h-8 animate-spin text-blue-500" />
      <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Synchronizing Vault</p>
    </div>
  );

  return (
    <div className="space-y-12">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="space-y-3">
          <h1 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-white/40">Vault</h1>
          <p className="text-white/40 font-semibold text-sm uppercase tracking-[0.2em]">Curated Learning Curriculums</p>
        </div>
        <Button 
          onClick={onUploadClick}
          className="h-16 px-8 font-black rounded-[1.5rem] bg-white text-black hover:bg-zinc-100 hover:scale-[1.03] transition-all shadow-2xl flex items-center gap-3 text-lg"
        >
          <Plus className="w-6 h-6" /> Add Content
        </Button>
      </header>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Local search removed in favor of global header search for 'perfect' consistency */}
      </div>

      {filteredSyllabi.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <AnimatePresence mode="popLayout">
            {filteredSyllabi.map((syllabus, i) => (
              <SyllabusCard 
                key={syllabus.id} 
                syllabus={syllabus} 
                i={i} 
                onSelect={onSelect} 
                onDelete={setDeleteId} 
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-40 glass-card rounded-[4rem] border-none text-center bg-white/[0.02]"
        >
          <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/10 shadow-inner">
            <Sparkles className="w-10 h-10 text-white/20" />
          </div>
          <h3 className="text-4xl font-black mb-4 tracking-tighter">Vault is Empty</h3>
          <p className="text-white/30 mb-12 max-w-sm mx-auto font-medium leading-relaxed">
            Your high-performance study engine is ready. Upload a curriculum to initialize your roadmap.
          </p>
          <Button 
            size="lg" 
            onClick={onUploadClick}
            className="h-18 px-12 text-xl font-black rounded-3xl bg-white text-black hover:bg-zinc-100 hover:scale-[1.03] transition-all shadow-2xl"
          >
            Add My First Curriculum
          </Button>
        </motion.div>
      )}

      {/* Premium Deletion Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="bg-[#0f0f13]/95 backdrop-blur-3xl border-white/10 rounded-[2.5rem] p-10 max-w-md overflow-hidden relative">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-[80px]" />
          
          <DialogHeader className="space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter text-white">Confirm Decommission</DialogTitle>
            <DialogDescription className="text-white/40 text-lg font-medium leading-relaxed">
              This action will permanently purge the curriculum from the vault. This cannot be reversed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-10 gap-4 sm:flex-col">
            <Button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full h-16 rounded-2xl bg-red-500 text-white font-black text-lg hover:bg-red-600 transition-all flex items-center justify-center gap-3"
            >
              {isDeleting ? "Purging..." : "Confirm Purge"}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setDeleteId(null)}
              className="w-full h-16 rounded-2xl bg-white/5 text-white/40 font-bold hover:bg-white/10 transition-all"
            >
              Abuse Operation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
