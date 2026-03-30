"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleCard } from "../components/ArticleCard";
import { SlideOver } from "../components/SlideOver";
import { Sidebar } from "../components/Sidebar";
import { TrendingSidebar } from "../components/TrendingSidebar";
import { Bars3Icon, HeartIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { PremiumAd } from "../components/PremiumAd";
import { TopNav } from "../components/TopNav";
import { SidebarFooter } from "../components/SidebarFooter";

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
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeArticle, setActiveArticle] = useState<FeedArticle | null>(null);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [openedBriefing, setOpenedBriefing] = useState(false);
  const [newArticleCount, setNewArticleCount] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const seenParagraphs = useRef<Set<number>>(new Set());
  const router = useRouter();

  // Use refs for mutable state accessed inside intervals/callbacks to avoid stale closures
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const latestKnownId = useRef<string | null>(null);
  const articlesRef = useRef<FeedArticle[]>([]);

  // Keep articlesRef in sync
  useEffect(() => {
    articlesRef.current = articles;
  }, [articles]);

  const loadFeed = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const currentOffset = reset ? 0 : offsetRef.current;

    try {
      const res = await fetch(
        `${API_URL}/api/feed?offset=${currentOffset}&limit=20`,
        { credentials: "include" }
      );
      if (!res.ok) return;

      const data = (await res.json()) as { articles: FeedArticle[] };

      setArticles((prev) => {
        const existingIds = new Set(prev.map(a => a.id));

        if (reset) {
          // Prepend genuinely new articles to the top
          const brandNew = data.articles.filter(a => !existingIds.has(a.id));
          if (brandNew.length === 0) return prev;
          return [...brandNew, ...prev];
        }

        // Append for infinite scroll
        const appendArticles = data.articles.filter(a => !existingIds.has(a.id));
        return [...prev, ...appendArticles];
      });

      // Track latest known article for background poll
      if (data.articles.length > 0 && !latestKnownId.current) {
        latestKnownId.current = data.articles[0]?.id ?? null;
      }

      if (reset) {
        // After a reset, update the latest known ID to what we just fetched
        if (data.articles[0]) latestKnownId.current = data.articles[0].id;
      } else {
        offsetRef.current = currentOffset + data.articles.length;
      }

      hasMoreRef.current = data.articles.length > 0;
      setHasMore(data.articles.length > 0);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []); // No dependencies — uses refs to avoid stale closures

  // Initial load
  useEffect(() => {
    loadFeed(true);
  }, []);

  // Infinite scroll
  useEffect(() => {
    const handler = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 400
      ) {
        if (hasMoreRef.current && !loadingRef.current) {
          loadFeed();
        }
      }
    };
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, [loadFeed]);

  // Live update: poll /feed/latest every 30s
  // When new AI-processed articles exist, auto-prepend them and show a count banner
  useEffect(() => {
    const checkAndUpdateFeed = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const res = await fetch(`${API_URL}/api/feed/latest`, { credentials: "include" });
        if (!res.ok) return;
        const { latestId } = await res.json() as { latestId: string | null; latestAt: string | null };
        if (!latestId) return;

        // First run — just record the baseline ID
        if (!latestKnownId.current) {
          latestKnownId.current = latestId;
          return;
        }

        // New article detected
        if (latestId !== latestKnownId.current) {
          // Auto-fetch and prepend new articles silently
          const feedRes = await fetch(`${API_URL}/api/feed?offset=0&limit=20`, { credentials: "include" });
          if (!feedRes.ok) return;
          const feedData = await feedRes.json() as { articles: FeedArticle[] };

          const currentIds = new Set(articlesRef.current.map(a => a.id));
          const brandNew = feedData.articles.filter(a => !currentIds.has(a.id));

          if (brandNew.length > 0) {
            setNewArticleCount(brandNew.length);
            setArticles(prev => {
              const existingIds = new Set(prev.map(a => a.id));
              const toAdd = brandNew.filter(a => !existingIds.has(a.id));
              return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
            });
            latestKnownId.current = latestId;
          }
        }
      } catch {
        // Silently ignore background poll failures
      }
    };

    // Delay first poll by 5s to ensure initial loadFeed completes first
    const initialTimer = setTimeout(() => checkAndUpdateFeed(), 5000);
    const interval = setInterval(checkAndUpdateFeed, 20 * 1000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, []); // Stable — uses refs and closures that don't go stale

  // Scroll to top and clear banner when user clicks it
  const handleRefreshBanner = useCallback(() => {
    setNewArticleCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
    try {
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
    } catch {
      console.warn("Signal failed (probably anonymous)");
    }
  };

  const handleClose = async () => {
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
    return activeArticle.content.split(/\n+/).map(p => p.trim()).filter(Boolean);
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
            const ratio = seenParagraphs.current.size / Math.max(1, paragraphs.length);
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

  const filteredArticles = useMemo(() => {
    if (selectedTopic === "All") return articles;
    return articles.filter((a) =>
      a.topicSlugs.some((s) => s.toLowerCase() === selectedTopic.toLowerCase())
    );
  }, [articles, selectedTopic]);

  const topics = ["All", "Business", "Technology", "World", "Markets", "Policy"];

  return (
    <div className="pb-24 md:pb-10">
      <SlideOver open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="The EconomicTimes" side="left">
        <Sidebar />
      </SlideOver>

      <div className="w-full flex bg-paper">
        <main className="flex-1 min-w-0 border-r border-et-border bg-paper">
          <TopNav title="Home" onMenuClick={() => setIsDrawerOpen(true)} hideAuthInfo={true} />
          <header className="sticky top-[64px] z-10 bg-white/95 backdrop-blur-md border-b border-et-border">
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

          {/* Live update banner */}
          {newArticleCount > 0 && (
            <div className="sticky top-[112px] z-20 flex justify-center pointer-events-none">
              <button
                onClick={handleRefreshBanner}
                className="pointer-events-auto mt-3 flex items-center gap-2 px-5 py-2.5 bg-et-headline text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-xl hover:bg-et-red transition-all animate-bounce-slow"
              >
                <ArrowUpIcon className="w-3.5 h-3.5" />
                {newArticleCount} new article{newArticleCount > 1 ? "s" : ""} added
              </button>
            </div>
          )}

          <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            {filteredArticles.map((article, index) => (
              <div key={article.id} className="space-y-6">
                <ArticleCard article={article as any} onClick={() => handleOpen(article)} />
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

        <aside className="hidden lg:block w-[350px] flex-shrink-0 px-4 h-screen sticky top-0 overflow-y-auto no-scrollbar pb-10 space-y-8">
          <TrendingSidebar />
          <PremiumAd variant="sidebar" className="mt-8" />
          <SidebarFooter />
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
              onClick={() => setShared(prev => !prev)}
            >Share</button>
            <button
              className={`rounded px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all ${
                saved ? "bg-et-red text-white" : "border border-et-border text-et-secondary hover:border-et-red hover:text-et-red"
              }`}
              onClick={() => setSaved(prev => !prev)}
            >Bookmark</button>
            <button
              className={`rounded px-4 py-2 transition-all flex items-center justify-center ${
                liked ? "text-et-red scale-110" : "text-et-secondary hover:text-et-red"
              }`}
              onClick={() => setLiked(prev => !prev)}
            >
              {liked ? <HeartIconSolid className="w-6 h-6" /> : <HeartIcon className="w-6 h-6" />}
            </button>
            {activeArticle?.storyId ? (
              <button
                onClick={handleOpenBriefing}
                className="rounded px-4 py-2 text-[11px] font-bold uppercase tracking-widest bg-et-headline text-white hover:bg-et-red transition-all"
              >Briefing</button>
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
                  (e.target as HTMLImageElement).src = "https://images.pexels.com/photos/35012972/pexels-photo-35012972.jpeg";
                }}
              />
            </div>
            <p className="text-lg font-serif italic text-et-secondary border-l-4 border-et-red pl-6 py-2 bg-et-section">
              {activeArticle.summary}
            </p>
            <div className="space-y-4">
              {paragraphs.map((paragraph, index) => (
                <p key={index} data-paragraph data-index={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        ) : null}
      </SlideOver>
    </div>
  );
}
