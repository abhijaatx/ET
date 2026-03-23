"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useChat } from "ai/react";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "../../../components/TopNav";
import { useAuthorProfile } from "../../../context/AuthorProfileContext";
import { PremiumAd } from "../../../components/PremiumAd";
import { BriefingStoryArc, type StoryArcData } from "../../../components/BriefingStoryArc";
import { LineChart, LayoutGrid, BookOpen, MessageSquare } from "lucide-react";

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

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch(`/api/articles/${storyId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles ?? []);
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

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        setBriefingError(null);
        const res = await fetch(`/api/briefing/${storyId}`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as BriefingDocument;
          setBriefing(data);
          setArticles((prev) => {
            const briefingArticles = data.source_articles || [];
            const updated = prev.map(p => {
              const match = briefingArticles.find(s => s.id === p.id);
              return match ? { ...p, ...match } : p;
            });
            const newArticles = briefingArticles.filter(s => !prev.some(p => p.id === s.id));
            return [...updated, ...newArticles.map(s => ({ ...s, published_at: s.published_at || null }))];
          });
        }
      } catch {}
    };
    fetchBriefing();
  }, [storyId]);

  useEffect(() => {
    const fetchArc = async () => {
      if (!storyId || !view || view !== "story-arc" || storyArc) return;
      setArcLoading(true);
      try {
        const res = await fetch(`/api/story-arc/${storyId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setStoryArc(data);
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

  return (
    <div className="h-screen flex flex-col bg-paper overflow-hidden font-display">
      <motion.header 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border-b border-mist bg-white/80 px-4 md:px-8 py-4 backdrop-blur-md shrink-0 z-20"
      >
        <div className="flex items-center justify-between">
          <TopNav />
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate/50">
            {activePane === 'left' ? (view === 'briefing' ? 'Intelligence Brief' : 'Visual Story Arc') : 'Source Coverage'}
          </div>
        </div>
      </motion.header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Pane: Briefing & AI Chat */}
        <div className={`w-full md:w-1/2 h-full overflow-y-auto border-r border-mist flex flex-col relative no-scrollbar transition-all duration-500 ${
          activePane === 'left' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-4 md:px-8 py-4 border-b border-mist/50 flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setView("briefing")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] md:text-[10px] whitespace-nowrap font-black uppercase tracking-widest transition-all ${
                view === "briefing" ? "bg-ink text-paper shadow-lg" : "bg-paper text-slate/40 hover:text-slate"
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              Intelligence Brief
            </button>
            <button
              onClick={() => setView("story-arc")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] md:text-[10px] whitespace-nowrap font-black uppercase tracking-widest transition-all ${
                view === "story-arc" ? "bg-ink text-paper shadow-lg" : "bg-paper text-slate/40 hover:text-slate"
              }`}
            >
              <LineChart className="w-3 h-3" />
              Visual Story Arc
            </button>
          </div>

          <div className="p-4 md:p-8 space-y-12 flex-1">
            <AnimatePresence mode="wait">
              {briefingError ? (
                <motion.div key="error" className="py-20 text-center text-et-red font-bold">{briefingError}</motion.div>
              ) : briefing ? (
                <motion.div 
                  key="briefing-container"
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-12"
                >
                  {view === "briefing" ? (
                    <>
                      {(briefing.executive_summary || briefing.summary?.text) && (
                        <motion.section variants={item} className="relative">
                          <div className="absolute -left-4 md:-left-8 top-0 bottom-0 w-1 bg-et-red opacity-20 rounded-full" />
                          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-et-red px-2 mb-4">The Bottom Line</h2>
                          <p className="text-xl md:text-2xl font-serif font-bold leading-relaxed text-ink">
                            {briefing.executive_summary || briefing.summary?.text}
                          </p>
                        </motion.section>
                      )}

                      <section className="space-y-6">
                        <motion.h2 variants={item} className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate/40 px-2">Analysis Sections</motion.h2>
                        <div className="grid gap-4">
                          {briefing.sections.map((section) => (
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
                    </>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {storyArc ? (
                        <BriefingStoryArc data={storyArc} onArticleClick={(id) => {
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
                  <span className="text-[10px] font-bold uppercase tracking-widest text-et-red">Primary Source</span>
                  <h2 className="text-2xl md:text-3xl font-display leading-tight">{activeSource.title}</h2>
                </div>
                <button onClick={() => setActiveSource(null)} className="w-10 h-10 shrink-0 rounded-full bg-white border border-mist flex items-center justify-center hover:bg-et-red hover:text-white transition-all">✕</button>
              </div>
              <div className="rounded-3xl md:rounded-[2.5rem] bg-white border border-mist p-6 md:p-10 shadow-soft overflow-y-auto no-scrollbar font-serif text-lg leading-relaxed text-ink/90">
                {activeSource.content.split("\n\n").map((p, i) => <p key={i} className="mb-6">{p}</p>)}
                <div className="mt-12 pt-6 border-t border-mist/50">
                  <a href={activeSource.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase tracking-[0.4em] text-et-red hover:underline">ACCESS JOURNAL ORIGIN →</a>
                </div>
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
    </div>
  );
}
