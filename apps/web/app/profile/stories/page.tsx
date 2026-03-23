"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeftIcon, 
  FireIcon, 
  ChevronRightIcon,
  BookOpenIcon,
  CalendarIcon
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Story {
  id: string;
  headline: string;
  articleCount: number;
  latestArticleAt: string | null;
}

export default function FollowedStoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/user/stories`, { credentials: "include" })
      .then(res => res.json())
      .then(data => setStories(data.stories || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Just now";
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-et-red italic">Core Briefings</div>
        </div>

        <header className="space-y-2">
          <h1 className="text-4xl font-serif font-black text-et-headline">Followed Stories</h1>
          <p className="text-et-secondary font-medium italic opacity-60">High-intensity coverage of the events that define market trends.</p>
        </header>

        {loading ? (
          <div className="grid gap-4">
             {[1, 2, 3].map(i => (
               <div key={i} className="h-24 bg-white/50 animate-pulse rounded-3xl" />
             ))}
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {stories.map((story, i) => (
                <Link key={story.id} href={`/briefing/${story.id}`}>
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-et-border flex items-center justify-between group hover:shadow-xl hover:border-et-red/20 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center group-hover:bg-et-red group-hover:text-white transition-all">
                        <FireIcon className="w-6 h-6 opacity-40 group-hover:opacity-100" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-lg font-serif font-bold text-et-headline group-hover:text-et-red transition-colors">{story.headline}</h2>
                        <div className="flex gap-4">
                           <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-et-meta">
                             <BookOpenIcon className="w-3.5 h-3.5 opacity-40" />
                             {story.articleCount} Articles
                           </div>
                           <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-et-meta">
                             <CalendarIcon className="w-3.5 h-3.5 opacity-40" />
                             Updated {formatDate(story.latestArticleAt)}
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-et-section rounded-2xl group-hover:bg-et-red group-hover:text-white transition-all">
                       <ChevronRightIcon className="w-5 h-5" />
                    </div>
                  </motion.div>
                </Link>
              ))}
            </AnimatePresence>
            {stories.length === 0 && (
              <div className="text-center py-20 bg-white/40 rounded-3xl border border-dashed border-et-divider">
                <p className="text-et-secondary italic">No stories followed yet. Use the "Follow Story" option in the news feed.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
