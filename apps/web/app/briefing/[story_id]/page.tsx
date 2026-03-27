"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useChat } from "ai/react";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "../../../components/TopNav";
import { Sidebar } from "../../../components/Sidebar";
import { SlideOver } from "../../../components/SlideOver";
import { LanguageSelector } from "../../../components/LanguageSelector";
import { useAuthorProfile } from "../../../context/AuthorProfileContext";
import { PremiumAd } from "../../../components/PremiumAd";
import { BriefingStoryArc, type StoryArcData } from "../../../components/BriefingStoryArc";
import { LineChart, LayoutGrid, BookOpen, MessageSquare, Star, Globe, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";

const STOCK_PHOTO = "https://images.pexels.com/photos/35012972/pexels-photo-35012972.jpeg";

type BriefingDocument = {
  story_id: string;
  headline: string;
  generated_at: string;
  depth_tier: string;
  summary?: { text: string; citations: string[] }; 
  executive_summary?: string;
  sections: { id: string; title: string; content: string; citations: string[] }[];
  key_entities: { name: string; type: string; role: string }[];
  suggested_questions: string[];
  source_articles: { id: string; title: string; url: string; content: string; author: string | null; authorId: string | null; published_at: string | null }[];
};

type ArticleItem = {
  id: string;
  title: string;
  url: string;
  content: string;
  author: string | null;
  authorId: string | null;
  published_at: string | null;
  vernacularCache?: Record<string, { title: string; content: string }>;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};

export default function BriefingPage() {
  const { openProfile } = useAuthorProfile();
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ story_id: string }>();
  const searchParams = useSearchParams();
  const storyId = params.story_id;
  const sourceId = searchParams.get("sourceId");

  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [articlesLoaded, setArticlesLoaded] = useState(false);
  const [briefing, setBriefing] = useState<BriefingDocument | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  const [view, setView] = useState<"briefing" | "story-arc">("briefing");
  const [storyArc, setStoryArc] = useState<StoryArcData | null>(null);
  const [arcLoading, setArcLoading] = useState(false);

  // Mobile state: 'left' (Briefing/Arc) or 'right' (Articles)
  const [activePane, setActivePane] = useState<"left" | "right">("left");
  const [activeSource, setActiveSource] = useState<ArticleItem | null>(null);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [currentLanguage, setCurrentLanguage] = useState("en");
  const [isLanguageDrawerOpen, setIsLanguageDrawerOpen] = useState(false);
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState(false);
  const [vernacularBriefing, setVernacularBriefing] = useState<BriefingDocument | null>(null);
  const [vernacularStoryArc, setVernacularStoryArc] = useState<StoryArcData | null>(null);
  const [vernacularArticles, setVernacularArticles] = useState<Record<string, { title: string; content: string }>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [articleTranslatingId, setArticleTranslatingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentLanguage === "en") {
      setVernacularBriefing(null);
      setVernacularStoryArc(null);
      setVernacularArticles({});
      return;
    }

    const fetchVernacular = async () => {
      setIsTranslating(true);
      try {
        // Fetch Briefing
        const briefingRes = await fetch(`/api/briefing/${storyId}/vernacular/${currentLanguage}`, { credentials: "include" });
        if (briefingRes.ok) {
          const data = await briefingRes.json();
          setVernacularBriefing(data);
        }

        // Fetch Story Arc
        const arcRes = await fetch(`/api/story-arc/${storyId}/vernacular/${currentLanguage}`, { credentials: "include" });
        if (arcRes.ok) {
          const data = await arcRes.json();
          setVernacularStoryArc(data);
        }
      } catch (e) {
        console.error("Failed to fetch vernacular content:", e);
      } finally {
        setIsTranslating(false);
      }
    };

    fetchVernacular();
  }, [storyId, currentLanguage]);

  useEffect(() => {
    const fetchFollowStatus = async () => {
      try {
        const res = await fetch("/api/stories/followed", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const followed = data.stories.some((s: any) => s.id === storyId);
          setIsFollowed(followed);
        }
      } catch {}
    };
    fetchFollowStatus();
  }, [storyId]);

  const toggleFollow = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setFollowLoading(true);
    try {
      const method = isFollowed ? "DELETE" : "POST";
      const endpoint = isFollowed ? `/api/stories/${storyId}/unfollow` : `/api/stories/${storyId}/follow`;
      const res = await fetch(endpoint, { method, credentials: "include" });
      if (res.ok) {
        setIsFollowed(!isFollowed);
      }
    } catch (e) {
      console.error("Failed to toggle follow:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch(`/api/articles/${storyId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setArticles((prev) => {
            const raw = data.articles ?? [];
            const seen = new Set<string>();
            const unique: ArticleItem[] = [];
            
            [...prev, ...raw].forEach(a => {
              const key = `${a.id}-${a.title}`;
              if (!seen.has(key) && !seen.has(a.id) && !seen.has(a.title)) {
                seen.add(a.id);
                seen.add(a.title);
                seen.add(key);
                unique.push(a);
              }
            });
            return unique;
          });
          setArticlesLoaded(true);
          if (sourceId) {
            const found = (data.articles ?? []).find((a: ArticleItem) => a.id === sourceId);
            if (found) {
              setActiveSource(found);
              setActivePane("right");
            }
          }
        }
      } catch {
        setArticlesLoaded(true);
      }
    };
    fetchArticles();
  }, [storyId, sourceId]);

  // Handle Article Translation
  useEffect(() => {
    if (currentLanguage === "en" || !activeSource) return;
    
    const cacheKey = `${activeSource.id}_${currentLanguage}`;
    if (vernacularArticles[cacheKey]) return;

    const translate = async () => {
      setArticleTranslatingId(activeSource.id);
      try {
        console.log(`[Vernacular] Fetching translation for article ${activeSource.id} in ${currentLanguage}...`);
        const res = await fetch(`/api/articles/${activeSource.id}/vernacular/${currentLanguage}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          console.log(`[Vernacular] Received translation for ${activeSource.id}:`, data);
          setVernacularArticles(prev => ({
            ...prev,
            [cacheKey]: data
          }));
        } else {
          console.error(`[Vernacular] Translation failed for ${activeSource.id}: ${res.status}`);
        }
      } catch (e) {
        console.error("Failed to translate article:", e);
      } finally {
        setArticleTranslatingId(null);
      }
    };
    translate();
  }, [activeSource, currentLanguage, vernacularArticles]);

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        setBriefingError(null);
        const res = await fetch(`/api/briefing/${storyId}`, { credentials: "include" });
        if (res.status === 200) {
          const data = (await res.json()) as BriefingDocument;
          // Ensure it's not an error object cast to BriefingDocument
          if (data && 'sections' in data) {
            setBriefing(data);
            setArticles((prev) => {
              const briefingArticles = data.source_articles || [];
              const all = [...prev, ...briefingArticles.map(s => ({ ...s, published_at: s.published_at || null }))];
              
              const seen = new Set<string>();
              const unique: ArticleItem[] = [];
              
              all.forEach(a => {
                const key = `${a.id}-${a.title}`;
                if (!seen.has(key) && !seen.has(a.id) && !seen.has(a.title)) {
                  seen.add(a.id);
                  seen.add(a.title);
                  seen.add(key);
                  unique.push(a);
                }
              });
              return unique;
            });
          }
        } else if (res.status === 202) {
          // Poll every 5 seconds if not ready
          setTimeout(fetchBriefing, 5000);
        } else {
          const errorData = await res.json();
          setBriefingError(errorData.error || "Failed to load briefing");
        }
      } catch (err) {
        console.error("Fetch briefing error:", err);
      }
    };
    fetchBriefing();
  }, [storyId]);

  useEffect(() => {
    const fetchArc = async () => {
      if (!storyId || !view || view !== "story-arc" || storyArc) return;
      setArcLoading(true);
      try {
        const res = await fetch(`/api/story-arc/${storyId}`, { credentials: "include" });
        if (res.status === 200) {
          const data = await res.json();
          if (data && 'timeline' in data) {
            setStoryArc(data);
          }
        } else if (res.status === 202) {
          // Poll every 5 seconds if not ready
          setTimeout(fetchArc, 5000);
        }
      } catch (e) {
        console.error("Failed to fetch story arc:", e);
      } finally {
        setArcLoading(false);
      }
    };
    fetchArc();
  }, [storyId, view, storyArc]);

  const { messages, input, handleInputChange, handleSubmit, setInput, isLoading } =
    useChat({
      api: `/api/briefing/${storyId}/ask`,
    });

  // Focus Time Tracking (Heartbeat)
  useEffect(() => {
    if (!storyId || !user) return;

    const interval = setInterval(() => {
      const targetArticleId = sourceId || briefing?.source_articles?.[0]?.id || articles?.[0]?.id;

      if (targetArticleId && document.visibilityState === "visible") {
        const url = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
        fetch(`${url}/api/signals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            article_id: targetArticleId,
            time_spent_s: 30,
            scroll_depth: 0.5,
            opened_briefing: true
          })
        }).catch(err => console.error("Focus heartbeat failed:", err));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [storyId, sourceId, briefing, articles]);

  return (
    <div className="h-screen flex flex-col bg-paper overflow-hidden font-display">
      <motion.header 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border-b border-mist bg-white/80 px-4 md:px-8 py-4 backdrop-blur-md shrink-0 z-20"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <TopNav title="Intelligence Brief" onMenuClick={() => setIsAppDrawerOpen(true)} hideAuthInfo={true} />
            <button
              onClick={() => setIsLanguageDrawerOpen(true)}
              className="p-2 rounded-full hover:bg-mist/10 transition-all text-slate/40 hover:text-et-red group relative"
              title="Change Language"
            >
              <Globe className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-et-red rounded-full border-2 border-white" />
            </button>
            <button
              onClick={toggleFollow}
              disabled={followLoading}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                isFollowed 
                  ? "bg-et-red text-white shadow-lg shadow-et-red/20" 
                  : "bg-paper text-slate/40 hover:text-et-red hover:bg-white border border-mist"
              }`}
            >
              <Star className={`w-3 h-3 ${isFollowed ? "fill-white" : ""}`} />
              {isFollowed ? "Following Story" : "Follow Story"}
            </button>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate/50">
            {activePane === 'left' ? (view === 'briefing' ? 'Intelligence Brief' : 'Visual Story Arc') : 'Source Coverage'}
          </div>
        </div>
      </motion.header>

      <SlideOver
        open={isAppDrawerOpen}
        onClose={() => setIsAppDrawerOpen(false)}
        title="The EconomicTimes"
        side="left"
      >
        <Sidebar />
      </SlideOver>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Pane: Briefing & AI Chat */}
        <div className={`w-full md:w-1/2 h-full overflow-y-auto border-r border-mist flex flex-col relative no-scrollbar transition-all duration-500 ${
          activePane === 'left' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-mist flex overflow-hidden shrink-0">
            <button
              onClick={() => setView("briefing")}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-r border-mist ${
                view === "briefing" ? "bg-white text-et-red" : "bg-paper/50 text-slate/40 hover:text-slate hover:bg-paper"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Intelligence Brief
            </button>
            <button
              onClick={() => setView("story-arc")}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                view === "story-arc" ? "bg-white text-et-red" : "bg-paper/50 text-slate/40 hover:text-slate hover:bg-paper"
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              Visual Story Arc
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-start overflow-y-auto no-scrollbar py-6 md:py-10">
            <div className="px-4 md:px-12 w-full max-w-4xl mx-auto">
              <AnimatePresence mode="wait">
                {briefingError ? (
                  <motion.div key="error" className="py-20 text-center text-et-red font-bold">{briefingError}</motion.div>
                ) : briefing ? (
                  <motion.div 
                    key="briefing-container"
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-12 my-auto mx-auto max-w-2xl w-full"
                  >
                    {view === "briefing" ? (
                      <div className="space-y-12">
                        {/* Headline Section */}
                        <motion.section variants={item}>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-px bg-et-red opacity-30" />
                            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate/40">
                              {briefing?.generated_at ? new Date(briefing.generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase() : 'TODAY'}
                            </span>
                          </div>
                          <h1 className="text-3xl md:text-5xl font-black leading-[1.1] text-ink mb-10 decoration-et-red/10 animate-fade-in pr-4">
                            {isTranslating ? (
                              <span className="flex items-center gap-3 italic text-slate/30 text-2xl md:text-3xl animate-pulse">
                                Adapting to {currentLanguage === 'hi' ? 'Hindi' : currentLanguage === 'ta' ? 'Tamil' : currentLanguage === 'te' ? 'Telugu' : 'Bengali'}...
                              </span>
                            ) : (
                              (vernacularBriefing || briefing)?.headline
                            )}
                          </h1>
                        </motion.section>

                        {/* Executive Summary Section */}
                        {(vernacularBriefing || briefing)?.executive_summary && (
                          <motion.section variants={item} className="relative">
                            <div className="absolute -left-4 md:-left-8 top-0 bottom-0 w-1 bg-et-red opacity-20 rounded-full" />
                            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-et-red px-2 mb-4">Executive Intel</h2>
                            <p className="text-xl md:text-2xl font-serif font-bold leading-relaxed text-ink italic">
                              {isTranslating ? '...' : (vernacularBriefing || briefing)?.executive_summary}
                            </p>
                          </motion.section>
                        )}

                        {/* Analysis Sections */}
                        <section className="space-y-6">
                          <motion.h2 variants={item} className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate/40 px-2">Analysis Sections</motion.h2>
                          <div className="grid gap-4">
                            {(vernacularBriefing || briefing)?.sections.map((section) => (
                              <motion.details
                                variants={item}
                                key={section.id}
                                className="rounded-3xl md:rounded-[2.5rem] border border-mist bg-white/40 hover:bg-white p-6 md:p-8 shadow-soft transition-all group overflow-hidden"
                              >
                                <summary className="cursor-pointer font-display text-xl md:text-2xl capitalize hover:text-et-red list-none flex items-center justify-between">
                                  <span>{section.title.replace(/-/g, " ")}</span>
                                  <span className="w-8 h-8 rounded-full bg-mist/20 flex items-center justify-center group-open:rotate-180 transition-transform">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                  </span>
                                </summary>
                                <div className="mt-6 text-base md:text-lg font-serif leading-relaxed text-ink/80">{section.content}</div>
                              </motion.details>
                            ))}
                          </div>
                        </section>

                        {/* Chat History Section */}
                        <section className="space-y-6 pt-12 border-t border-mist/50">
                          <motion.h2 variants={item} className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate/40 px-2">AI Correspondent</motion.h2>
                          <div className="space-y-4">
                            {messages.map((m) => (
                              <div key={m.id} className={`rounded-[2rem] px-6 md:px-8 py-6 text-sm ${m.role === "assistant" ? "bg-white shadow-soft border border-mist/30" : "bg-ink text-paper ml-4 md:ml-8"}`}>
                                <div className="whitespace-pre-wrap leading-relaxed text-base">{m.content}</div>
                              </div>
                            ))}
                            {isLoading && <div className="text-[10px] font-bold uppercase tracking-widest text-slate/40 px-8">Synthesizing...</div>}
                          </div>
                        </section>
                        <PremiumAd variant="banner" className="mt-12" />
                      </div>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="my-auto mx-auto max-w-4xl w-full">
                        {(vernacularStoryArc || storyArc) ? (
                          <BriefingStoryArc data={{
                            ...(vernacularStoryArc || storyArc)!,
                            timeline: (vernacularStoryArc || storyArc)!.timeline.map(item => ({
                              ...item,
                              author: articles.find(a => a.id === item.article_id)?.author || undefined
                            })),
                            contrarian_views: (vernacularStoryArc || storyArc)!.contrarian_views.map(item => ({
                              ...item,
                              author: articles.find(a => a.id === item.source_article_id)?.author || undefined
                            }))
                          }} onArticleClick={(id) => {
                            const article = articles.find(a => a.id === id);
                            if (article) {
                              setActiveSource(article);
                              setActivePane("right");
                            }
                          }} />
                        ) : arcLoading ? (
                          <div className="py-20 text-center animate-pulse text-[10px] font-bold uppercase tracking-[0.3em] text-slate/40">Analyzing History...</div>
                        ) : (
                          <div className="py-20 text-center text-slate/40">Story Arc analysis unavailable for this story.</div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <div className="py-20 text-center animate-pulse font-bold text-slate/20">LOADING BRIEFING...</div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-mist p-4 md:p-8 z-10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input value={input} onChange={handleInputChange} placeholder="Ask AI..." className="flex-1 rounded-full border border-mist bg-paper/50 px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-et-red/20" />
                <button type="submit" className="px-6 md:px-8 py-4 bg-ink text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-et-red transition-all">ASK</button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Pane: Document Viewer */}
        <div className={`w-full md:w-1/2 h-full bg-paper/30 relative flex flex-col p-4 md:p-8 no-scrollbar overflow-y-auto transition-all duration-500 ${
          activePane === 'right' ? 'flex' : 'hidden md:flex'
        }`}>
          {activeSource ? (
            <div className="space-y-8 pb-12">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-et-red">
                    {articleTranslatingId === activeSource.id ? "Translating Source..." : "Primary Source"}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-display leading-tight">
                    {vernacularArticles[`${activeSource.id}_${currentLanguage}`]?.title || activeSource.title}
                  </h2>
                  {activeSource.author && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mt-1">BY {activeSource.author}</p>
                  )}
                </div>
                <button onClick={() => setActiveSource(null)} className="w-10 h-10 shrink-0 rounded-full bg-white border border-mist flex items-center justify-center hover:bg-et-red hover:text-white transition-all">✕</button>
              </div>
              <div className="rounded-3xl md:rounded-[2.5rem] bg-white border border-mist p-6 md:p-10 shadow-soft overflow-y-auto no-scrollbar font-serif text-lg leading-relaxed text-ink/90">
                {articleTranslatingId === activeSource.id ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-mist/20 rounded w-full" />
                    <div className="h-4 bg-mist/20 rounded w-5/6" />
                    <div className="h-4 bg-mist/20 rounded w-4/5" />
                  </div>
                ) : (
                  (vernacularArticles[`${activeSource.id}_${currentLanguage}`]?.content || activeSource.content)
                    .split("\n\n").map((p, i) => <p key={i} className="mb-6">{p}</p>)
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-slate/30 text-center">Reference Coverage</p>
              <div className="grid gap-3">
                {articles.map((a) => (
                  <button key={a.id} onClick={() => setActiveSource(a)} className="w-full text-left p-6 rounded-3xl border border-mist bg-white/60 hover:bg-white hover:shadow-soft transition-all group">
                    <p className="font-serif font-bold text-lg group-hover:text-et-red transition-colors leading-snug">{a.title}</p>
                    {a.author && <p className="text-[10px] font-bold uppercase tracking-widest text-slate/40 mt-2">By {a.author}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Navigation Toggle Bar */}
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-mist flex md:hidden z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setActivePane("left")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              activePane === 'left' ? 'text-et-red' : 'text-slate/40'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Analysis</span>
          </button>
          <div className="w-px h-8 bg-mist my-auto" />
          <button 
            onClick={() => setActivePane("right")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              activePane === 'right' ? 'text-et-red' : 'text-slate/40'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Articles</span>
          </button>
        </div>
      </div>

      {/* Language Drawer */}
      <AnimatePresence>
        {isLanguageDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLanguageDrawerOpen(false)}
              className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full md:w-80 bg-white shadow-2xl z-50 p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-12">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate/40">Select Language</h2>
                <button 
                  onClick={() => setIsLanguageDrawerOpen(false)}
                  className="p-2 rounded-full hover:bg-mist/20 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 space-y-8">
                <div className="p-6 rounded-[2rem] bg-paper border border-mist/50">
                  <p className="text-sm font-serif leading-relaxed text-ink/60 mb-6 italic">
                    Experience real-time, culturally adapted business intelligence in your preferred vernacular.
                  </p>
                  <LanguageSelector 
                    currentLanguage={currentLanguage}
                    onLanguageChange={(lang) => {
                      setCurrentLanguage(lang);
                      setIsLanguageDrawerOpen(false);
                    }}
                  />
                </div>
              </div>
              
              <div className="mt-auto pt-8 border-t border-mist/30">
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate/30 text-center leading-relaxed">
                  Powered by Google Gemini<br/>
                  Vernacular Engine v2.0
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
