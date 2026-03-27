"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  PlayIcon, 
  PauseIcon, 
  ArrowPathIcon, 
  SpeakerWaveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [progress, setProgress] = useState(0);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const expectedIndexRef = useRef(-1);
  const isNavigatingRef = useRef(false);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakRequestRef = useRef(0);
  const prefetchedAudioMap = useRef<Map<string, string>>(new Map());
  const inflightAudioMap = useRef<Map<string, Promise<string>>>(new Map());

  const stopCurrentAudio = useCallback(() => {
    speakRequestRef.current += 1;

    if (!currentAudioRef.current) {
      return;
    }

    currentAudioRef.current.onended = null;
    currentAudioRef.current.onerror = null;
    currentAudioRef.current.onplay = null;
    currentAudioRef.current.onplaying = null;
    currentAudioRef.current.onwaiting = null;
    currentAudioRef.current.onstalled = null;
    currentAudioRef.current.oncanplaythrough = null;
    currentAudioRef.current.pause();
    currentAudioRef.current.src = "";
    currentAudioRef.current.load();
    currentAudioRef.current = null;
  }, []);

  const prunePrefetchedAudio = useCallback((nextScenes: Scene[]) => {
    const nextNarrations = new Set(nextScenes.map((scene) => scene.narration));

    for (const [text, objectUrl] of prefetchedAudioMap.current.entries()) {
      if (nextNarrations.has(text)) {
        continue;
      }

      URL.revokeObjectURL(objectUrl);
      prefetchedAudioMap.current.delete(text);
    }
  }, []);

  const fetchAudioUrl = useCallback(async (text: string) => {
    const cachedAudioUrl = prefetchedAudioMap.current.get(text);
    if (cachedAudioUrl) {
      return cachedAudioUrl;
    }

    const inflightRequest = inflightAudioMap.current.get(text);
    if (inflightRequest) {
      return inflightRequest;
    }

    console.log(`[TTS] Fetching narration audio: ${text.substring(0, 30)}...`);

    const request = fetch(`${API_URL}/api/broadcast/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || `TTS request failed with ${res.status}`);
        }

        const audioBlob = await res.blob();
        const objectUrl = URL.createObjectURL(audioBlob);
        prefetchedAudioMap.current.set(text, objectUrl);
        return objectUrl;
      })
      .finally(() => {
        inflightAudioMap.current.delete(text);
      });

    inflightAudioMap.current.set(text, request);
    return request;
  }, []);

  const prefetch = useCallback((text: string) => {
    if (!text || prefetchedAudioMap.current.has(text) || inflightAudioMap.current.has(text)) {
      return;
    }

    console.log(`[TTS] Prefetching next narration: ${text.substring(0, 30)}...`);
    void fetchAudioUrl(text).catch((err) => {
      console.error("[TTS] Prefetch failed:", err);
    });
  }, [fetchAudioUrl]);

  const speak = useCallback(async (text: string, onEnd: () => void) => {
    stopCurrentAudio();
    const requestId = speakRequestRef.current;

    try {
      const audioUrl = await fetchAudioUrl(text);

      if (speakRequestRef.current !== requestId) {
        return;
      }

      const audio = new Audio(audioUrl);
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      audio.onplay = () => console.log("[TTS] Groq Audio Started");
      audio.onplaying = () => console.log("[TTS] Groq Audio Playing");
      audio.onwaiting = () => console.log("[TTS] Groq Audio Buffering...");
      audio.onstalled = () => console.log("[TTS] Groq Audio Stalled");
      audio.oncanplaythrough = () => console.log("[TTS] Groq Audio Ready to play through");
      audio.onended = () => {
        console.log("[TTS] Groq Audio Ended");
        if (speakRequestRef.current === requestId) {
          onEnd();
        }
      };
      audio.onerror = () => {
        console.error("[TTS] Groq Audio Error:", audio.error);
        if (speakRequestRef.current === requestId) {
          setTimeout(onEnd, 3000);
        }
      };

      await audio.play();
      setIsAudioBlocked(false);
    } catch (err: any) {
      console.error("[TTS] Play failed:", err);
      if (err?.name === "NotAllowedError" || String(err?.message ?? "").includes("interact")) {
        setIsAudioBlocked(true);
      } else {
        setTimeout(onEnd, 3000);
      }
    }
  }, [fetchAudioUrl, stopCurrentAudio]);

  const fetchBroadcast = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/broadcast/generate`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scenes && data.scenes.length > 0) {
          prunePrefetchedAudio(data.scenes);
          setScenes(data.scenes);
          setCurrentIndex(0);
          setIsPlaying(true);
          if (data.scenes[0]) {
            prefetch(data.scenes[0].narration);
          }
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
  }, [prefetch, prunePrefetchedAudio]);

  const [error, setError] = useState<string | null>(null);

  const fetchWithTimeout = useCallback(async () => {
    setError(null);
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out")), 15000)
    );

    try {
        await Promise.race([fetchBroadcast(), timeoutPromise]);
    } catch (e: any) {
        setError(e.message || "Failed to connect to news engine");
        setLoading(false);
    }
  }, [fetchBroadcast]);

  useEffect(() => {
    fetchWithTimeout();
  }, [fetchWithTimeout]);

  useEffect(() => {
    return () => {
      stopCurrentAudio();

      for (const objectUrl of prefetchedAudioMap.current.values()) {
        URL.revokeObjectURL(objectUrl);
      }

      prefetchedAudioMap.current.clear();
      inflightAudioMap.current.clear();
    };
  }, [stopCurrentAudio]);

  useEffect(() => {
    if (bgMusicRef.current) {
        // Lower volume for background ambient effect
        bgMusicRef.current.volume = 0.15;
        if (isPlaying && !loading && musicEnabled) {
            bgMusicRef.current.play().catch(e => {
                console.warn("Music playback failed", e);
                // Also trigger the blocked overlay if music fails (likely same reason as narration)
                if (e?.name === "NotAllowedError") {
                    setIsAudioBlocked(true);
                }
            });
        } else {
            bgMusicRef.current.pause();
        }
    }
  }, [isPlaying, loading, musicEnabled]);

  const next = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    if (currentIndex < scenes.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setProgress(0);
    } else {
        console.log("[Broadcast] Restarting continuous feed...");
        setCurrentIndex(0);
        setProgress(0);
        setPlaybackKey(prev => prev + 1);
        fetchBroadcast(true); // Silent re-fetch
    }
    
    setTimeout(() => { isNavigatingRef.current = false; }, 500);
  }, [currentIndex, scenes.length, fetchBroadcast]);

  const prev = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setProgress(0);
    }

    setTimeout(() => { isNavigatingRef.current = false; }, 500);
  }, [currentIndex]);

  useEffect(() => {
    if (!isPlaying || currentIndex < 0 || currentIndex >= scenes.length) {
      return;
    }

    const currentScene = scenes[currentIndex];
    if (!currentScene) return;

    expectedIndexRef.current = currentIndex;

    speak(currentScene.narration, () => {
        if (isPlaying && expectedIndexRef.current === currentIndex) {
            next();
        }
    });

    // Prefetch next scene
    const nextScene = scenes[currentIndex + 1];
    if (nextScene) {
      prefetch(nextScene.narration);
    }

    const durationMs = currentScene.duration * 1000;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min((elapsed / durationMs) * 100, 99));
    }, 50);

    return () => {
      clearInterval(interval);
      stopCurrentAudio();
    };
  }, [currentIndex, isPlaying, scenes, speak, next, prefetch, playbackKey, stopCurrentAudio]);

  if (error) {
    return (
        <div className="h-screen bg-et-section flex flex-col items-center justify-center text-et-headline p-10 space-y-8">
            <div className="w-20 h-20 rounded-2xl bg-white border border-et-border shadow-soft flex items-center justify-center">
                <SignalIcon className="w-10 h-10 text-et-meta" />
            </div>
            <div className="text-center space-y-3 max-w-sm">
                <h2 className="text-2xl font-serif font-black tracking-tight text-et-headline">{error}</h2>
                <p className="text-sm text-et-secondary leading-relaxed">The news engine is currently re-indexing the latest stories. Please try again in a moment.</p>
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={() => router.back()}
                    className="px-6 py-3 rounded-xl border border-et-border font-bold uppercase tracking-widest text-[10px] hover:bg-et-section transition-all"
                >
                    Go Back
                </button>
                <button 
                    onClick={() => fetchWithTimeout()}
                    className="px-8 py-3 rounded-xl bg-et-red text-white font-bold uppercase tracking-widest text-[10px] hover:shadow-lg transition-all active:scale-95"
                >
                    Retry Broadcast
                </button>
            </div>
        </div>
    );
  }

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
      <audio 
        ref={bgMusicRef}
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        loop
      />
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
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em]">CONTINUOUS LIVE AI</span>
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
            <div className="flex items-center gap-3 md:gap-6 shrink-0">
                <button 
                    onClick={prev}
                    disabled={currentIndex === 0}
                    className="p-3 md:p-4 rounded-full border border-et-border text-et-secondary hover:text-et-red hover:border-et-red transition-all disabled:opacity-30 disabled:hover:border-et-border disabled:hover:text-et-secondary"
                >
                    <ChevronLeftIcon className="w-5 h-5 md:w-6 h-6" />
                </button>

                <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-et-headline text-white flex items-center justify-center hover:bg-et-red transition-all shadow-xl hover:scale-105 active:scale-95 shrink-0"
                >
                    {isPlaying ? <PauseIcon className="w-7 h-7 md:w-10 md:h-10" /> : <PlayIcon className="w-7 h-7 md:w-10 md:h-10 ml-1" />}
                </button>

                <button 
                    onClick={next}
                    className="p-3 md:p-4 rounded-full border border-et-border text-et-secondary hover:text-et-red hover:border-et-red transition-all"
                >
                    <ChevronRightIcon className="w-5 h-5 md:w-6 h-6" />
                </button>
            </div>

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
                            className="text-[9px] md:text-[12px] font-serif font-black text-et-headline italic leading-snug tracking-tight"
                        >
                            "{currentScene?.narration}"
                        </motion.p>
                    </AnimatePresence>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setMusicEnabled(!musicEnabled)}
                        className={`p-3 md:p-4 rounded-xl border transition-all ${musicEnabled ? 'border-et-red text-et-red bg-et-red/5' : 'border-et-border text-et-secondary hover:border-et-red/50 hover:text-et-red/50'}`}
                        title={musicEnabled ? "Disable Music" : "Enable Music"}
                    >
                        <SpeakerWaveIcon className={`w-4 h-4 md:w-5 md:h-5 ${musicEnabled ? 'animate-pulse' : ''}`} />
                    </button>
                    <button 
                        onClick={() => {
                            setCurrentIndex(0);
                            setIsPlaying(true);
                            setProgress(0);
                            setPlaybackKey(prev => prev + 1);
                        }}
                        className="p-3 md:p-4 rounded-xl border border-et-border hover:border-et-red hover:text-et-red transition-all group active:bg-et-section"
                        title="Restart Show"
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
      <AnimatePresence>
        {isAudioBlocked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-et-headline/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="bg-white rounded-[2.5rem] p-10 md:p-12 max-w-md w-full text-center space-y-8 shadow-2xl border border-white/20">
              <div className="w-24 h-24 bg-et-red/10 rounded-full flex items-center justify-center mx-auto relative">
                <SpeakerWaveIcon className="w-12 h-12 text-et-red animate-pulse" />
                <div className="absolute inset-0 rounded-full border-2 border-et-red/20 animate-ping" />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-serif font-black tracking-tight text-et-headline italic">Ready for Broadcast</h3>
                <p className="text-sm text-et-secondary leading-relaxed font-medium">To begin the personalized AI news narration with background music, please click the button below.</p>
              </div>
              <button 
                onClick={() => {
                  setIsAudioBlocked(false);
                  setIsPlaying(true);
                  // Force play music and current audio
                  if (bgMusicRef.current && musicEnabled) {
                    bgMusicRef.current.play().catch(console.error);
                  }
                  if (currentAudioRef.current) {
                    currentAudioRef.current.play().catch(console.error);
                  }
                }}
                className="w-full py-5 rounded-2xl bg-et-red text-white font-black uppercase tracking-[0.2em] text-xs hover:shadow-2xl hover:shadow-et-red/30 transition-all active:scale-95 shadow-xl shadow-et-red/20"
              >
                Start AI Broadcast
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
