import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Zap,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { parseSyllabus } from '../services/geminiService';
import { auth } from '../lib/firebase';
import { createSyllabus } from '../services/firestoreService';

interface SyllabusUploadProps {
  onComplete: (syllabusId: string) => void;
}

export default function SyllabusUpload({ onComplete }: SyllabusUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState('4');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      if (!name) setName(acceptedFiles[0].name.replace(/\.[^/.]+$/, ""));
      setError(null);
    }
  }, [name]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/plain': ['.txt']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file || !name || !examDate || !dailyHours) {
      setError('Please fill in all fields and select a syllabus file.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(10);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      setUploadProgress(30);
      
      let content = '';
      let mimeType = file.type;

      if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
        const reader = new FileReader();
        content = await new Promise((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        content = await file.text();
        mimeType = 'text/plain'; // Fallback
      }

      setUploadProgress(50);
      const topics = await parseSyllabus(content, mimeType);
      
      if (topics.length === 0) {
        throw new Error('Could not extract any topics. Please try a clearer file.');
      }

      setUploadProgress(70);
      
      const syllabusId = await createSyllabus(
        user.uid, 
        { 
            name, 
            examDate, 
            dailyHours: parseInt(dailyHours) 
        }, 
        topics
      );

      setUploadProgress(100);
      onComplete(syllabusId);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to process syllabus. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-12">
      <div className="flex flex-col items-center text-center mb-16 space-y-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400 flex items-center gap-2"
        >
          <Sparkles className="w-3 h-3" /> Intelligent Parsing
        </motion.div>
        
        <h1 className="text-6xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/40 leading-[1.1]">
          Feed the <span className="text-blue-400">Engine</span>.
        </h1>
        <p className="text-lg text-white/40 max-w-2xl font-medium leading-relaxed">
          Upload your syllabus and let our breakdown engine create a high-precision study roadmap tailored to your exam date.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
        <div className="lg:col-span-4">
          <div 
            {...getRootProps()} 
            className="relative group cursor-pointer h-full"
          >
            <div className={`absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-600/10 to-transparent rounded-[3rem] blur-2xl transition-opacity duration-700 ${isDragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            
            <div className={`relative h-full glass-card rounded-[3rem] p-16 border-2 border-dashed flex flex-col items-center justify-center text-center transition-all duration-500 min-h-[500px] ${
              isDragActive ? 'border-purple-500/50 bg-purple-500/5' : 'border-white/10 hover:border-white/20'
            }`}>
              <input {...getInputProps()} />
              
              <AnimatePresence mode="wait">
                {!file ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    <div className="w-28 h-28 bg-white/5 backdrop-blur-3xl rounded-[2rem] flex items-center justify-center mx-auto border border-white/10 shadow-2xl group-hover:scale-110 group-hover:bg-white/10 transition-all duration-500">
                      <Upload className="w-10 h-10 text-white/40 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold tracking-tight mb-3">Drop your files here</h3>
                      <p className="text-white/40 font-medium">Supports PDF, JPG, PNG or TXT</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="file-selected"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-sm space-y-10"
                  >
                    <div className="relative w-40 h-40 mx-auto">
                      <div className="absolute inset-0 bg-blue-500/20 rounded-[2.5rem] blur-3xl animate-pulse" />
                      <div className="relative w-full h-full bg-white/5 backdrop-blur-3xl rounded-[2.5rem] flex items-center justify-center border border-white/20 shadow-2xl">
                        <FileText className="w-16 h-16 text-blue-400" />
                      </div>
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="absolute -top-3 -right-3 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:bg-zinc-200 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </motion.button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold tracking-tight line-clamp-1">{file.name}</p>
                      <p className="text-white/30 font-bold uppercase tracking-widest text-[10px]">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • READY
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Syllabus Detected
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-8">
          <Card className="glass-card border-none p-10 bg-white/5 rounded-[3rem] space-y-10">
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight">Configuration</h3>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Adjust engine parameters</p>
            </div>
            
            <div className="space-y-10">
              <div className="space-y-4">
                <Label htmlFor="name" className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-1">
                  Syllabus Name
                </Label>
                <Input 
                  id="name"
                  placeholder="e.g. Computer Science 101"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-14 bg-white/5 border-white/5 rounded-2xl px-6 focus:bg-white/10 focus:border-purple-500/30 transition-all text-sm font-medium"
                />
              </div>

              <div className="space-y-4">
                <Label htmlFor="date" className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-1">
                  Target Exam Date
                </Label>
                <Input 
                  id="date"
                  type="date" 
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="h-14 bg-white/5 border-white/5 rounded-2xl px-6 focus:bg-white/10 focus:border-purple-500/30 transition-all text-sm font-medium [color-scheme:dark]"
                />
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-1">
                  Daily Study Velocity
                </Label>
                <div className="grid grid-cols-4 gap-3">
                  {['2', '4', '6', '8'].map((h) => (
                    <button
                      key={h}
                      onClick={() => setDailyHours(h)}
                      className={`h-12 rounded-xl text-sm font-bold transition-all border ${
                        dailyHours === h 
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white border-transparent shadow-lg shadow-purple-500/20' 
                          : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Button 
            onClick={handleUpload}
            disabled={isUploading || !file || !examDate || !name}
            className="w-full h-24 rounded-[3rem] bg-white text-black text-xl font-black hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-white/5 group relative overflow-hidden"
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="tracking-tight">Initializing Analysis...</span>
                </div>
                <div className="w-48 h-1 bg-black/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 tracking-tight">
                Parse & Breakdown <ChevronRight className="w-7 h-7 group-hover:translate-x-1.5 transition-transform" />
              </div>
            )}
          </Button>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-[2rem] bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-semibold flex items-center gap-4"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
