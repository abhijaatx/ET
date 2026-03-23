"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleCard } from "../components/ArticleCard";
import { SlideOver } from "../components/SlideOver";
import { Sidebar } from "../components/Sidebar";
import { TrendingSidebar } from "../components/TrendingSidebar";
import { Bars3Icon, HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { PremiumAd } from "../components/PremiumAd";

type FeedArticle = {
  id: string;
  storyId: string | null;
  title: string;
  frame: string;
  source: string;
  publishedAt: string | null;
  topicSlugs: string[];
  content: string;
  summary: string;
  url: string;
  author: string | null;
  authorId: string | null;
  isLiked?: boolean;
  isBookmarked?: boolean;
  imageUrl?: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function formatTime(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Recently";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function estimateReadTime(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 210));
  return `${minutes} min read`;
}

export default function FeedPage() {
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeArticle, setActiveArticle] = useState<FeedArticle | null>(null);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [openedBriefing, setOpenedBriefing] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const seenParagraphs = useRef<Set<number>>(new Set());
  const router = useRouter();

  const loadFeed = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      const res = await fetch(
        `${API_URL}/api/feed?offset=${currentOffset}&limit=20`,
        {
          credentials: "include"
        }
      );
      if (res.status === 401) {
        router.push("/login");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { articles: FeedArticle[] };
      setArticles((prev) => (reset ? data.articles : [...prev, ...data.articles]));
      setOffset((prev) => (reset ? 20 : prev + 20));
      setHasMore(data.articles.length === 20);
      setLoading(false);
    },
    [loading, offset, router]
  );

  useEffect(() => {
    loadFeed(true);
  }, [loadFeed]);

  useEffect(() => {
    const handler = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 400
      ) {
        if (hasMore && !loading) {
          loadFeed();
        }
      }
    };
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, [hasMore, loading, loadFeed]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadFeed(true);
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadFeed]);

  const handleOpen = (article: FeedArticle) => {
    setActiveArticle(article);
    setOpenedAt(Date.now());
    setScrollDepth(0);
    setShared(false);
    setSaved(false);
    setLiked(false);
    setOpenedBriefing(false);
  };

  const sendSignal = async (openedBriefingOverride?: boolean) => {
    if (!activeArticle) return;
    const timeSpentS = openedAt
      ? Math.max(1, Math.round((Date.now() - openedAt) / 1000))
      : 0;

    await fetch(`${API_URL}/api/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        article_id: activeArticle.id,
        time_spent_s: timeSpentS,
        scroll_depth: scrollDepth,
        opened_briefing: openedBriefingOverride ?? openedBriefing,
        shared,
        saved,
        liked
      })
    });
  };

  const handleClose = async () => {
    // Fire and forget the signal to avoid blocking the UI close action
    sendSignal();
    setActiveArticle(null);
  };

  const handleOpenBriefing = async () => {
    if (!activeArticle?.storyId) return;
    setOpenedBriefing(true);
    await sendSignal(true);
    const storyId = activeArticle.storyId;
    const articleId = activeArticle.id;
    setActiveArticle(null);
    router.push(`/briefing/${storyId}?sourceId=${articleId}`);
  };

  const paragraphs = useMemo(() => {
    if (!activeArticle) return [];
    return activeArticle.content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [activeArticle]);

  useEffect(() => {
    if (!activeArticle) return;
    seenParagraphs.current.clear();
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-index"));
          if (entry.isIntersecting && Number.isFinite(index)) {
            seenParagraphs.current.add(index);
            const ratio =
              seenParagraphs.current.size / Math.max(1, paragraphs.length);
            setScrollDepth(Math.min(1, ratio));
          }
        });
      },
      { threshold: 0.6 }
    );

    const nodes = document.querySelectorAll("[data-paragraph]");
    nodes.forEach((node) => observerRef.current?.observe(node));

    return () => observerRef.current?.disconnect();
  }, [activeArticle, paragraphs.length]);

  const [selectedTopic, setSelectedTopic] = useState("All");

  const filteredArticles = useMemo(() => {
    if (selectedTopic === "All") return articles;
    return articles.filter((a) =>
      a.topicSlugs.some((s) => s.toLowerCase() === selectedTopic.toLowerCase())
    );
  }, [articles, selectedTopic]);

  const topics = ["All", "Business", "Technology", "World", "Finance", "Markets", "Policy"];

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="pb-24 md:pb-10">
      <SlideOver
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="The EconomicTimes"
        side="left"
      >
        <Sidebar />
      </SlideOver>

      <div className="w-full flex bg-paper">
        {/* Main Feed */}
        <main className="flex-1 min-w-0 border-r border-et-border bg-paper">
          <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-et-border">
            <div className="px-4 py-3 flex items-center gap-4">
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 hover:bg-et-section rounded-full transition-colors text-et-headline"
              >
                <Bars3Icon className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold font-serif tracking-tight text-et-headline">Home</h1>
            </div>
            <div className="flex overflow-x-auto no-scrollbar border-b border-et-border bg-et-section pl-2 md:pl-16 pr-4">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors relative flex-shrink-0 hover:text-et-red ${
                    selectedTopic === topic ? "text-et-red" : "text-et-secondary"
                  }`}
                >
                  {topic}
                  {selectedTopic === topic && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-et-red" />
                  )}
                </button>
              ))}
            </div>
          </header>

          <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            {filteredArticles.map((article, index) => (
              <div key={article.id} className="space-y-6">
                <ArticleCard
                  article={article as any}
                  onClick={() => handleOpen(article)}
                />
                {(index + 1) % 5 === 0 && (
                  <PremiumAd variant="feed" className="my-10" />
                )}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12 bg-white">
              <div className="w-8 h-8 border-4 border-et-divider border-t-et-red rounded-full animate-spin" />
            </div>
          ) : null}
        </main>

        {/* Right Sidebar (Widgets) */}
        <aside className="hidden lg:block w-[350px] flex-shrink-0 px-4 h-screen sticky top-0 overflow-y-auto no-scrollbar pb-10">
          <TrendingSidebar />
          <PremiumAd variant="sidebar" className="mt-8" />
        </aside>
      </div>




      <SlideOver
        open={Boolean(activeArticle)}
        onClose={handleClose}
        title={activeArticle?.title ?? "Article"}
        variant="modal"
        isJustified={true}
        footer={
          <div className="flex items-center gap-3">
            <button
              className={`rounded px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all ${
                shared ? "bg-et-red text-white" : "border border-et-border text-et-secondary hover:border-et-red hover:text-et-red"
              }`}
              onClick={() => setShared((prev) => !prev)}
            >
              Share
            </button>
            <button
              className={`rounded px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all ${
                saved ? "bg-et-red text-white" : "border border-et-border text-et-secondary hover:border-et-red hover:text-et-red"
              }`}
              onClick={() => setSaved((prev) => !prev)}
            >
              Bookmark
            </button>
            <button
              className={`rounded px-4 py-2 transition-all flex items-center justify-center ${
                liked ? "text-et-red scale-110" : "text-et-secondary hover:text-et-red"
              }`}
              onClick={() => setLiked((prev) => !prev)}
            >
              {liked ? (
                <HeartIconSolid className="w-6 h-6" />
              ) : (
                <HeartIcon className="w-6 h-6" />
              )}
            </button>
            {activeArticle?.storyId ? (
              <button
                onClick={handleOpenBriefing}
                className="rounded px-4 py-2 text-[11px] font-bold uppercase tracking-widest bg-et-headline text-white hover:bg-et-red transition-all"
              >
                Briefing
              </button>
            ) : null}
          </div>
        }
      >
        {activeArticle ? (
          <div className="space-y-6 text-[15px] leading-relaxed text-et-body">
            <div className="text-[11px] font-bold uppercase tracking-widest text-et-meta border-b border-et-divider pb-4">
              {activeArticle.source} · {formatTime(activeArticle.publishedAt)}
            </div>

            <div className="w-full h-[300px] rounded-2xl overflow-hidden border border-et-border bg-et-section relative">
              <img 
                src={activeArticle.imageUrl || "https://images.pexels.com/photos/35012972/pexels-photo-35012972.jpeg"} 
                alt={activeArticle.title} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-150471143881b-5110bd08f23f?auto=format&fit=crop&q=80&w=600";
                }}
              />
            </div>
            
            <p className="text-lg font-serif italic text-et-secondary border-l-4 border-et-red pl-6 py-2 bg-et-section">
              {activeArticle.summary}
            </p>

            <div className="space-y-4">
              {paragraphs.map((paragraph, index) => (
                <p key={index} data-paragraph data-index={index}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </SlideOver>
    </div>
  );
}
