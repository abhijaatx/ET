"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  PlayIcon, 
  PauseIcon, 
  ArrowPathIcon, 
  SpeakerWaveIcon,
  ChevronLeftIcon,
  SignalIcon
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Scene {
  duration: number;
  narration: string;
  visualType: "breaking_news" | "market_update" | "world_map" | "tech_focus" | "conclusion" | "image" | "video";
  overlayTitle: string;
  overlayBullets: string[];
  imageUrl: string;
}

export default function BroadcastPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const fetchBroadcast = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/broadcast/generate`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scenes && data.scenes.length > 0) {
          setScenes(data.scenes);
          setCurrentIndex(0);
          setIsPlaying(true);
        } else {
          console.warn("No broadcast scenes generated");
        }
      } else {
        console.error("Broadcast generation failed", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch broadcast", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcast();
    // Pre-load voices for Chrome/Chromium
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, [fetchBroadcast]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Pick a high-quality English voice
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha") || (v.lang === "en-US" && v.name.includes("Male")));
    if (premiumVoice) utterance.voice = premiumVoice;
    
    utterance.rate = 1.05; // Slightly faster for energy
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!isPlaying || currentIndex < 0 || currentIndex >= scenes.length) {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      return;
    }

    const currentScene = scenes[currentIndex];
    if (!currentScene) return;

    // Trigger voice narration
    speak(currentScene.narration);

    const durationMs = currentScene.duration * 1000;
    
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress((elapsed / durationMs) * 100);
    }, 50);

    timerRef.current = setTimeout(() => {
      clearInterval(interval);
      if (currentIndex < scenes.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setProgress(0);
      } else {
        setIsPlaying(false);
      }
    }, durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(interval);
    };
  }, [currentIndex, isPlaying, scenes, speak]);

  if (loading) {
    return (
      <div className="h-screen bg-et-section flex flex-col items-center justify-center text-et-headline space-y-6">
        <div className="w-16 h-16 border-4 border-et-divider border-t-et-red rounded-full animate-spin" />
        <div className="text-center space-y-2">
            <h2 className="text-2xl font-serif font-black tracking-tight">Gathering Breaking News</h2>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-et-red animate-pulse">Initializing AI Producer...</p>
        </div>
      </div>
    );
  }

  const currentScene = scenes[currentIndex];

  return (
    <div className="h-screen bg-et-section overflow-hidden flex flex-col relative text-et-headline font-sans">
      <div className="z-50 bg-white border-b border-et-border px-4 md:px-8 py-2 md:py-3 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 hover:text-et-red transition-all group"
        >
          <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-et-secondary">Back</span>
        </button>
        
        <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2 px-2 py-0.5 md:py-1 bg-et-red rounded text-white shadow-sm">
                <SignalIcon className="w-2.5 h-2.5 md:w-3 h-3 animate-pulse" />
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em]">LIVE AI</span>
            </div>
            <h1 className="text-base md:text-lg font-serif font-black tracking-tighter italic">Broadcaster</h1>
        </div>

        <div className="flex items-center gap-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-et-secondary">
          <div className="px-2 py-0.5 border border-et-border rounded-md text-et-meta">
            {currentIndex + 1}/{scenes.length}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-4 md:p-10 items-center justify-center relative bg-et-section overflow-y-auto md:overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]" />
        
        <div className="w-full max-w-5xl aspect-[9/16] md:aspect-video bg-white rounded-2xl md:rounded-3xl border border-et-border shadow-soft overflow-hidden relative group max-h-[70vh] md:max-h-[60vh]">
           <AnimatePresence mode="wait">
            {currentScene && (
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                    className="absolute inset-0"
                >
                    <div className="absolute inset-0 w-full h-full bg-et-headline overflow-hidden">
                        <motion.div
                            initial={{ scale: 1.1, filter: "brightness(0.5) blur(4px)" }}
                            animate={{ scale: 1, filter: "brightness(0.4) blur(0px)" }}
                            transition={{ duration: currentScene.duration, ease: "linear" }}
                            className="absolute inset-0 w-full h-full"
                        >
                            {currentScene.imageUrl ? (
                                <img 
                                    src={currentScene.imageUrl} 
                                    className="w-full h-full object-cover"
                                    alt="Scene background" 
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-et-secondary/40 to-black" />
                            )}
                        </motion.div>

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
                        
                        <div className="absolute inset-0 flex flex-col md:flex-row items-center justify-center p-6 md:p-12 lg:p-20 z-10 gap-8 md:gap-16">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0, rotate: -15 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                transition={{ duration: 1, type: "spring" }}
                                className="flex items-center justify-center shrink-0"
                            >
                                <div className="relative w-32 h-32 md:w-56 md:h-56 lg:w-72 lg:h-72 rounded-2xl border-2 border-white/20 bg-white/5 backdrop-blur-xl flex items-center justify-center shadow-2xl overflow-hidden hidden md:flex">
                                     {currentScene.imageUrl && (
                                        <img 
                                            src={currentScene.imageUrl} 
                                            className="absolute inset-0 w-full h-full object-cover opacity-60 scale-110"
                                            alt="Overlay background"
                                        />
                                     )}
                                    <div className="absolute inset-0 bg-et-red/10 animate-pulse" />
                                </div>
                            </motion.div>

                            <div className="space-y-4 md:space-y-6 text-center md:text-left">
                                <div className="space-y-2 md:space-y-4">
                                    <motion.div 
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="flex items-center justify-center md:justify-start gap-3"
                                    >
                                        <div className="w-4 h-0.5 bg-et-red hidden md:block" />
                                        <span className="text-et-red text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em]">Briefing Analysis</span>
                                    </motion.div>
                                    <motion.h1 
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.4 }}
                                        className="text-2xl md:text-5xl lg:text-5xl font-serif font-black leading-tight tracking-tight text-white drop-shadow-md"
                                    >
                                        {currentScene.overlayTitle}
                                    </motion.h1>
                                </div>
                                <ul className="space-y-2 md:space-y-3 inline-block text-left">
                                    {currentScene.overlayBullets.map((bullet, i) => (
                                        <motion.li 
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.6 + i * 0.2 }}
                                            className="flex items-center gap-3 md:gap-4 text-white/80 text-sm md:text-xl font-medium tracking-tight"
                                        >
                                            <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-et-red rounded-full shrink-0 shadow-[0_0_8px_rgba(226,27,34,0.6)]" />
                                            {bullet}
                                        </motion.li>
                                    ))}
                                </ul>
                            </div>
                         </div>
                    </div>
                </motion.div>
            )}
           </AnimatePresence>

        </div>
      </div>

      <div className="bg-white border-t border-et-divider shadow-[0_-20px_60px_rgba(0,0,0,0.03)] z-50">
        <div className="max-w-7xl mx-auto">

            <div className="px-6 md:px-12 py-6 md:py-8 flex flex-col md:flex-row items-center gap-6 md:gap-12">
                <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-et-headline text-white flex items-center justify-center hover:bg-et-red transition-all shadow-xl hover:scale-105 active:scale-95 shrink-0"
                >
                    {isPlaying ? <PauseIcon className="w-7 h-7 md:w-10 md:h-10" /> : <PlayIcon className="w-7 h-7 md:w-10 md:h-10 ml-1" />}
                </button>

                <div className="flex-1 space-y-2 md:space-y-4 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-4">
                        <div className="hidden md:block px-2 py-0.5 bg-et-section border border-et-border rounded text-[9px] font-black uppercase tracking-widest text-et-meta">Narration</div>
                        <div className="flex-1 max-w-[200px] md:max-w-none h-1 bg-et-divider relative overflow-hidden rounded-full">
                            <motion.div 
                                className="absolute top-0 left-0 bottom-0 bg-et-red shadow-[0_0_10px_rgba(226,27,34,0.5)]"
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.1, ease: "linear" }}
                            />
                        </div>
                    </div>
                    
                    <AnimatePresence mode="wait">
                        <motion.p 
                            key={currentIndex}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.4 }}
                            className="text-lg md:text-2xl font-serif font-black text-et-headline italic leading-snug tracking-tight"
                        >
                            "{currentScene?.narration}"
                        </motion.p>
                    </AnimatePresence>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => {
                            setCurrentIndex(0);
                            setIsPlaying(true);
                            setProgress(0);
                        }}
                        className="p-3 md:p-4 rounded-xl border border-et-border hover:border-et-red hover:text-et-red transition-all group active:bg-et-section"
                        title="Replay"
                    >
                        <ArrowPathIcon className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-180 transition-transform duration-700" />
                    </button>
                    <button 
                        className="p-3 md:p-4 rounded-xl border border-et-border hover:bg-et-section transition-all"
                        title="Share"
                    >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
