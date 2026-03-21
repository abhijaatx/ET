"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "../components/TopNav";
import { ArticleCard } from "../components/ArticleCard";
import { SlideOver } from "../components/SlideOver";

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
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function formatTime(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
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
        saved
      })
    });
  };

  const handleClose = async () => {
    await sendSignal();

    setActiveArticle(null);
  };

  const handleOpenBriefing = async () => {
    if (!activeArticle?.storyId) return;
    setOpenedBriefing(true);
    await sendSignal(true);
    setActiveArticle(null);
    router.push(`/briefing/${activeArticle.storyId}`);
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

  return (
    <div>
      <TopNav />
      <div className="mt-6 grid gap-6">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            title={article.frame}
            source={article.source}
            time={formatTime(article.publishedAt)}
            topic={article.topicSlugs[0] ?? "business"}
            readTime={estimateReadTime(article.content)}
            onClick={() => handleOpen(article)}
          />
        ))}
      </div>
      {loading ? (
        <div className="mt-8 text-center text-sm uppercase tracking-[0.2em] text-slate">
          Loading
        </div>
      ) : null}

      <SlideOver
        open={Boolean(activeArticle)}
        onClose={handleClose}
        title={activeArticle?.title ?? ""}
        footer={
          <div className="flex items-center gap-3">
            <button
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                shared ? "border-accent text-accent" : "border-mist"
              }`}
              onClick={() => setShared((prev) => !prev)}
            >
              Share
            </button>
            <button
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                saved ? "border-accent text-accent" : "border-mist"
              }`}
              onClick={() => setSaved((prev) => !prev)}
            >
              Save
            </button>
            {activeArticle?.storyId ? (
              <button
                onClick={handleOpenBriefing}
                className="rounded-full border border-ink px-4 py-2 text-xs uppercase tracking-[0.2em]"
              >
                Open Briefing
              </button>
            ) : null}
          </div>
        }
      >
        {activeArticle ? (
          <div className="space-y-4 text-base leading-relaxed text-ink">
            <div className="text-sm uppercase tracking-[0.2em] text-slate">
              {activeArticle.source} · {formatTime(activeArticle.publishedAt)}
            </div>
            <p className="text-lg text-slate">{activeArticle.summary}</p>
            {paragraphs.map((paragraph, index) => (
              <p key={index} data-paragraph data-index={index}>
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}
      </SlideOver>
    </div>
  );
}
