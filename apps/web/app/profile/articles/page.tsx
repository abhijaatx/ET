"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowLeftIcon, 
  BookOpenIcon, 
  ClockIcon, 
  CalendarIcon 
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ArticleHistory {
  id: string;
  title: string;
  summary: string;
  author: string | null;
  publishedAt: string | null;
  readAt: string;
  timeSpent: number;
}

export default function ArticlesReadPage() {
  const [history, setHistory] = useState<ArticleHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/user/articles`, { credentials: "include" })
      .then(res => res.json())
      .then(data => setHistory(data.history || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="min-h-screen bg-et-section p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/profile">
            <button className="flex items-center gap-2 text-et-meta font-bold hover:text-et-red transition-colors">
              <ArrowLeftIcon className="w-4 h-4" />
              BACK TO PROFILE
            </button>
          </Link>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-et-red italic">Insight History</div>
        </div>

        <header className="space-y-2">
          <h1 className="text-4xl font-serif font-black text-et-headline">Articles Read</h1>
          <p className="text-et-secondary font-medium italic opacity-60">A detailed record of your progressive news journey.</p>
        </header>

        {loading ? (
          <div className="grid gap-4">
             {[1, 2, 3].map(i => (
               <div key={i} className="h-32 bg-white/50 animate-pulse rounded-3xl" />
             ))}
          </div>
        ) : (
          <div className="grid gap-6">
            {history.map((article, i) => (
              <motion.div 
                key={`${article.id}-${article.readAt}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-et-border shadow-sm flex items-start gap-8 group hover:shadow-xl hover:border-et-red/20 transition-all"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-et-red group-hover:text-white transition-all">
                  <BookOpenIcon className="w-8 h-8 opacity-40 group-hover:opacity-100" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-et-red">{article.author || "Global Staff"}</div>
                      <h2 className="text-xl font-serif font-bold text-et-headline group-hover:text-et-red transition-colors">{article.title}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-et-body line-clamp-2 leading-relaxed opacity-70 italic font-serif">"{article.summary}"</p>
                  <div className="flex gap-6 pt-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-et-meta">
                      <CalendarIcon className="w-4 h-4 opacity-40" />
                      Read on {formatDate(article.readAt)}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-et-meta">
                      <ClockIcon className="w-4 h-4 opacity-40" />
                      Focus Time: {formatTime(article.timeSpent)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {history.length === 0 && (
              <div className="text-center py-20 bg-white/40 rounded-3xl border border-dashed border-et-divider">
                <p className="text-et-secondary italic">No reading history found. Explore the feed to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
