"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeftIcon, 
  UserCircleIcon, 
  UsersIcon,
  TagIcon,
  MinusCircleIcon
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Author {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  followersCount: number;
}

export default function FollowedAuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAuthors = () => {
    fetch(`${API_URL}/api/user/authors`, { credentials: "include" })
      .then(res => res.json())
      .then(data => setAuthors(data.authors || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  const handleUnfollow = async (authorId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/authors/${authorId}/unfollow`, {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        setAuthors(prev => prev.filter(a => a.id !== authorId));
      }
    } catch (err) {
      console.error("Unfollow failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-et-section p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/profile">
            <button className="flex items-center gap-2 text-et-meta font-bold hover:text-et-red transition-colors">
              <ArrowLeftIcon className="w-4 h-4" />
              BACK TO PROFILE
            </button>
          </Link>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-et-red italic">Influence Network</div>
        </div>

        <header className="space-y-2">
          <h1 className="text-4xl font-serif font-black text-et-headline">Followed Authors</h1>
          <p className="text-et-secondary font-medium italic opacity-60">The expert voices shaping your daily economic perspective.</p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1, 2, 3].map(i => (
               <div key={i} className="h-48 bg-white/50 animate-pulse rounded-3xl" />
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {authors.map((author, i) => (
                <motion.div 
                  key={author.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 border border-et-border group hover:border-et-red transition-all shadow-sm"
                >
                  <div className="flex gap-4 items-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-et-section overflow-hidden border-2 border-white shadow-sm ring-1 ring-et-divider group-hover:ring-et-red/20 transition-all">
                      {author.avatarUrl ? (
                         <img src={author.avatarUrl} alt={author.name} className="w-full h-full object-cover" />
                      ) : (
                         <UserCircleIcon className="w-full h-full text-et-divider" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-bold text-et-headline uppercase group-hover:text-et-red transition-colors">{author.name}</h3>
                      <p className="text-et-meta text-[11px] font-bold tracking-widest uppercase">@{author.handle}</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-et-secondary italic line-clamp-2 mb-6 opacity-80 leading-relaxed">
                    "{author.bio || "No bio available."}"
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-et-divider">
                     <div className="flex items-center gap-1 text-[10px] font-bold text-et-headline uppercase tracking-tighter">
                       <UsersIcon className="w-3.5 h-3.5 text-et-red" />
                       {author.followersCount.toLocaleString()} Followers
                     </div>
                     <button 
                       onClick={() => handleUnfollow(author.id)}
                       className="flex items-center gap-1.5 px-4 py-1.5 bg-et-section border border-et-border rounded-full text-[10px] font-extrabold uppercase tracking-widest text-et-headline hover:bg-et-red hover:text-white hover:border-et-red transition-all"
                     >
                       <MinusCircleIcon className="w-3.5 h-3.5" />
                       Unfollow
                     </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {authors.length === 0 && (
              <div className="col-span-full text-center py-20 bg-white/40 rounded-3xl border border-dashed border-et-divider">
                <p className="text-et-secondary italic">You haven't followed any authors yet. Find them in the briefing analysis.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
