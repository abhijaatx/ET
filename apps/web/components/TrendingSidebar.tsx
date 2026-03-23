"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { useAuthorProfile } from "../context/AuthorProfileContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Author {
  id: string;
  name: string;
  handle: string;
  avatar_url?: string;
}

interface TrendingItem {
  id: string;
  category: string;
  topic: string;
  count: string;
}

export function TrendingSidebar() {
  const { openProfile } = useAuthorProfile();
  const router = useRouter();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loadingAuthors, setLoadingAuthors] = useState(true);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [authorsRes, trendingRes] = await Promise.all([
          fetch(`${API_URL}/api/authors?limit=3`),
          fetch(`${API_URL}/api/feed/trending`, { credentials: "include" })
        ]);
        const authorsData = await authorsRes.json();
        const trendingData = await trendingRes.json();
        setAuthors(authorsData.authors || []);
        setTrending(trendingData.trending || []);
      } catch (err) {
        console.error("Failed to fetch sidebar data", err);
      } finally {
        setLoadingAuthors(false);
        setLoadingTrending(false);
      }
    }
    loadData();
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <div className="py-6 space-y-6 sticky top-0 h-screen overflow-y-auto hidden lg:block px-4">
      <div className="sticky top-0 bg-et-section/95 backdrop-blur-md pb-4 z-10 space-y-4">
        <div className="relative group">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-et-meta transition-colors group-focus-within:text-et-red" />
          <input 
            type="text" 
            placeholder="Search News" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
            className="w-full bg-white border border-et-border rounded-xl py-3 pl-12 pr-4 outline-none focus:border-et-red focus:ring-1 focus:ring-et-red/10 shadow-sm transition-all text-[14px]"
          />
        </div>
        <h2 className="text-[18px] font-bold font-serif text-et-headline px-1">What's happening</h2>
      </div>
      
      {/* Trending Card */}
      <div className="bg-white rounded-xl overflow-hidden border border-et-border shadow-sm">
        <div className="divide-y divide-et-divider">
          {loadingTrending ? (
            <div className="p-8 flex justify-center">
              <div className="w-5 h-5 border-2 border-et-divider border-t-et-red rounded-full animate-spin" />
            </div>
          ) : trending.length > 0 ? (
            trending.map((item, i) => (
              <div 
                key={i} 
                className="px-6 py-4 hover:bg-et-section cursor-pointer transition-colors group"
                onClick={() => router.push(`/briefing/${item.id}`)}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-extrabold text-et-red uppercase tracking-widest">{item.category}</p>
                  <p className="text-[10px] text-et-meta font-bold">{item.count}</p>
                </div>
                <p className="font-serif font-bold text-[15px] text-et-headline leading-tight group-hover:text-et-red transition-colors">{item.topic}</p>
              </div>
            ))
          ) : (
            <p className="px-6 py-8 text-center text-xs text-et-meta italic">No trending stories right now.</p>
          )}
        </div>
        <button className="w-full text-left px-6 py-4 text-et-red hover:bg-et-section transition-colors text-[13px] font-bold uppercase tracking-wider">
          Show more
        </button>
      </div>

      {/* Authors Card */}
      <div className="bg-white rounded-xl overflow-hidden border border-et-border shadow-sm">
        <h2 className="px-6 py-4 text-[17px] font-bold font-serif border-b border-et-divider text-et-headline">Who to follow</h2>
        <div className="divide-y divide-et-divider">
          {loadingAuthors ? (
            <div className="p-8 flex justify-center">
              <div className="w-5 h-5 border-2 border-et-divider border-t-et-red rounded-full animate-spin" />
            </div>
          ) : authors.map((author: Author) => (
            <div 
              key={author.id} 
              className="px-6 py-4 hover:bg-et-section cursor-pointer transition-colors flex items-center gap-4 group"
              onClick={() => openProfile(author.id)}
            >
              <div className="w-10 h-10 rounded-full bg-et-section flex items-center justify-center font-bold text-et-meta text-xs border border-et-border group-hover:border-et-red transition-colors">
                {author.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[14px] text-et-headline truncate group-hover:text-et-red transition-colors">{author.name}</p>
                <p className="text-et-meta text-[11px] truncate mt-0.5 font-medium">@{author.handle}</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  // Follow logic could go here
                }}
                className="bg-et-headline text-white p-2 rounded-lg hover:bg-et-red transition-all shadow-sm"
              >
                <UserPlusIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button className="w-full text-left px-6 py-4 text-et-red hover:bg-et-section transition-colors text-[13px] font-bold uppercase tracking-wider border-t border-et-divider">
          Show more
        </button>
      </div>

      <div className="px-4 text-xs text-et-meta flex flex-wrap gap-x-3 gap-y-1 opacity-70">
        <span className="hover:underline cursor-pointer">Terms of Service</span>
        <span className="hover:underline cursor-pointer">Privacy Policy</span>
        <span className="hover:underline cursor-pointer">Cookie Policy</span>
        <span>© 2026 News Navigator Inc.</span>
      </div>
    </div>
  );
}
