"use client";

import { useEffect, useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { UserIcon, NewspaperIcon, UsersIcon, TagIcon } from "@heroicons/react/24/outline";

interface Author {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  followersCount: number;
  genres: string[];
  articleCount: number;
  isFollowing: boolean;
  avatar_url?: string;
}

interface Article {
  id: string;
  title: string;
  summary: string;
  source: string;
  published_at: string;
  tags: string[];
}

const DUMMY_PROFILES: Record<string, Author> = {
  "rajan-1": {
    id: "rajan-1",
    name: "Raghuram Rajan",
    handle: "RRajan",
    bio: "Former Governor of the RBI. Economist specializing in financial regulation and economic development.",
    followersCount: 1250000,
    genres: ["Economics", "Policy", "Finance"],
    articleCount: 42,
    isFollowing: false,
    avatar_url: "/avatars/rajan.png"
  },
  "kotak-1": {
    id: "kotak-1",
    name: "Uday Kotak",
    handle: "ukotak",
    bio: "Founder and CEO of Kotak Mahindra Bank. Veteran Indian banker and business leader.",
    followersCount: 850000,
    genres: ["Banking", "Finance", "Strategy"],
    articleCount: 15,
    isFollowing: false,
    avatar_url: "/avatars/kotak.png"
  },
  "shaw-1": {
    id: "shaw-1",
    name: "Kiran Mazumdar-Shaw",
    handle: "kiranshaw",
    bio: "Executive Chairperson of Biocon. Biotech pioneer and business leader focused on affordable healthcare.",
    followersCount: 920000,
    genres: ["Biotech", "Healthcare", "Business"],
    articleCount: 28,
    isFollowing: false,
    avatar_url: "/avatars/shaw.png"
  },
  "nilekani-1": {
    id: "nilekani-1",
    name: "Nandan Nilekani",
    handle: "Nilekani",
    bio: "Co-founder of Infosys. Architect of Aadhaar. Expert in digital public infrastructure and technology.",
    followersCount: 1100000,
    genres: ["Technology", "Digital", "Governance"],
    articleCount: 35,
    isFollowing: false,
    avatar_url: "/avatars/nilekani.png"
  }
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function AuthorProfile({ authorId }: { authorId: string }) {
  const [author, setAuthor] = useState<Author | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (DUMMY_PROFILES[authorId]) {
        setAuthor(DUMMY_PROFILES[authorId]);
        setArticles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [aRes, fRes] = await Promise.all([
          fetch(`${API_URL}/api/authors/${authorId}`, { credentials: "include" }),
          fetch(`${API_URL}/api/authors/${authorId}/articles`)
        ]);
        
        const aData = await aRes.json();
        const fData = await fRes.json();
        
        setAuthor(aData);
        setArticles(fData.articles || []);
      } catch (err) {
        console.error("Failed to load author data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [authorId]);

  const toggleFollow = async () => {
    if (!author || actionLoading) return;

    if (DUMMY_PROFILES[authorId]) {
      setAuthor(prev => prev ? {
        ...prev,
        isFollowing: !prev.isFollowing,
        followersCount: !prev.isFollowing ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1)
      } : null);
      return;
    }

    setActionLoading(true);
    try {
      const endpoint = author.isFollowing ? "unfollow" : "follow";
      const res = await fetch(`${API_URL}/api/authors/${authorId}/${endpoint}`, {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        setAuthor(prev => prev ? { 
          ...prev, 
          isFollowing: data.isFollowing,
          followersCount: data.isFollowing ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1)
        } : null);
      }
    } catch (err) {
      console.error("Toggle follow failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-et-divider border-t-et-red rounded-full animate-spin" />
      </div>
    );
  }

  if (!author) return <div>Author not found.</div>;

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-et-border p-8 shadow-sm">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-et-section flex items-center justify-center border-2 border-et-border shrink-0 overflow-hidden">
            {author.avatar_url ? (
              <img src={author.avatar_url} alt={author.name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-12 h-12 text-et-meta" />
            )}
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold font-serif text-et-headline">{author.name}</h2>
                <p className="text-et-meta text-sm font-medium">@{author.handle}</p>
              </div>
              <button 
                onClick={toggleFollow}
                disabled={actionLoading}
                className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-md active:scale-95 uppercase tracking-wider ${
                  author.isFollowing 
                    ? "bg-et-section text-et-headline border border-et-border hover:bg-et-red hover:text-white"
                    : "bg-et-headline text-white hover:bg-et-red"
                } ${actionLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {actionLoading ? "Processing..." : author.isFollowing ? "Following" : "Follow"}
              </button>
            </div>
            
            <p className="text-et-body leading-relaxed max-w-2xl italic font-serif opacity-80">
              "{author.bio}"
            </p>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2 group cursor-default">
                <UsersIcon className="w-4 h-4 text-et-red" />
                <span className="text-sm font-bold text-et-headline">{author.followersCount.toLocaleString()}</span>
                <span className="text-xs text-et-meta font-bold uppercase tracking-widest">Followers</span>
              </div>
              <div className="flex items-center gap-2 group cursor-default">
                <NewspaperIcon className="w-4 h-4 text-et-red" />
                <span className="text-sm font-bold text-et-headline">{author.articleCount}</span>
                <span className="text-xs text-et-meta font-bold uppercase tracking-widest">Articles</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {author.genres.map(genre => (
                <div key={genre} className="flex items-center gap-1.5 px-3 py-1 bg-et-section border border-et-border rounded-full text-[10px] font-bold uppercase tracking-widest text-et-secondary">
                  <TagIcon className="w-3 h-3 text-et-red" />
                  {genre}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Author Feed */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-et-meta border-b border-et-divider pb-4 flex items-center gap-3">
          <NewspaperIcon className="w-4 h-4" />
          Latest from {author.name}
        </h3>
        
        <div className="space-y-6">
          {articles.length > 0 ? (
            articles.map(article => (
              <ArticleCard 
                key={article.id} 
                article={{
                  ...article,
                  author: author.name,
                  authorId: author.id
                } as any}
                onClick={() => {}} // Could link to full article if desired
              />
            ))
          ) : (
            <div className="text-center py-10 text-et-meta italic">No articles yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
