"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArticleCard } from "../../components/ArticleCard";
import { Sidebar } from "../../components/Sidebar";
import { TrendingSidebar } from "../../components/TrendingSidebar";
import { SlideOver } from "../../components/SlideOver";
import { Bars3Icon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { SidebarFooter } from "../../components/SidebarFooter";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const router = useRouter();

  const fetchResults = useCallback(async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/feed/search?q=${encodeURIComponent(query)}`, {
        credentials: "include"
      });
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleArticleClick = (article: any) => {
    if (article.storyId) {
      router.push(`/briefing/${article.storyId}?sourceId=${article.id}`);
    }
  };


  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return (
    <div className="min-h-screen bg-et-section">
      <SlideOver
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="The EconomicTimes"
        side="left"
      >
        <Sidebar />
      </SlideOver>

      <div className="max-w-7xl mx-auto flex gap-6 px-4 py-8">
        <main className="flex-1 space-y-8">
           <header className="flex items-center justify-between bg-white p-6 rounded-3xl border border-et-border shadow-sm">
             <div className="flex items-center gap-4">
               <button 
                 onClick={() => setIsDrawerOpen(true)}
                 className="lg:hidden p-2 hover:bg-et-section rounded-full"
               >
                 <Bars3Icon className="w-6 h-6" />
               </button>
               <div>
                 <h1 className="text-2xl font-serif font-bold text-et-headline">Search Results</h1>
                 <p className="text-xs text-et-meta uppercase tracking-widest mt-1">Found {articles.length} results for "{query}"</p>
               </div>
             </div>
             <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-et-section rounded-full text-et-meta">
               <MagnifyingGlassIcon className="w-4 h-4" />
               <span className="text-xs font-bold">{query}</span>
             </div>
           </header>

           <div className="space-y-6">
             {loading ? (
               <div className="flex justify-center py-20">
                 <div className="w-10 h-10 border-4 border-et-divider border-t-et-red rounded-full animate-spin" />
               </div>
             ) : articles.length > 0 ? (
               articles.map((article) => (
                 <ArticleCard 
                   key={article.id} 
                   article={article} 
                   onClick={handleArticleClick}
                 />
               ))
             ) : (
               <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-et-divider">
                 <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-4 opacity-10 text-et-headline" />
                 <p className="text-et-secondary italic">No stories found matching your search.</p>
               </div>
             )}
           </div>
        </main>

        <aside className="hidden xl:block w-80 space-y-8">
          <TrendingSidebar />
          <SidebarFooter />
        </aside>
      </div>
    </div>
  );
}
