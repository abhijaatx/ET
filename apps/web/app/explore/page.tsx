"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Bars3Icon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  ChatBubbleLeftRightIcon
} from "@heroicons/react/24/outline";
import { Sidebar } from "../../components/Sidebar";
import { TrendingSidebar } from "../../components/TrendingSidebar";
import { SlideOver } from "../../components/SlideOver";
import { PremiumAd } from "../../components/PremiumAd";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const STOCK_PHOTO = "https://images.pexels.com/photos/35012972/pexels-photo-35012972.jpeg";

interface TrendingItem {
  id: string;
  category: string;
  topic: string;
  count: string;
  latestArticleAt?: string;
}

function formatTime(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  const diffHrs = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

// Highly reliable high-res URLs for news/business/tech contexts
const mediaFallbacks = [
  "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg", // Business meeting
  "https://images.pexels.com/photos/2582937/pexels-photo-2582937.jpeg", // Tech/Future
  "https://images.pexels.com/photos/7841311/pexels-photo-7841311.jpeg", // Markets/Finance
  "https://images.pexels.com/photos/395196/pexels-photo-395196.jpeg",   // Writing/Media
  "https://images.pexels.com/photos/164527/pexels-photo-164527.jpeg",   // Coins/Economy
  "https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg", // Collaboration
  "https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg", // Tech professional
  "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg", // Innovation
];

function SafeImage({ src, alt, className }: { src: string | undefined, alt: string, className?: string }) {
  const [imgSrc, setImgSrc] = useState(src || STOCK_PHOTO);
  
  useEffect(() => {
    setImgSrc(src || STOCK_PHOTO);
  }, [src]);

  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      className={className} 
      onError={() => setImgSrc(STOCK_PHOTO)}
    />
  );
}

export default function ExplorePage() {
  const router = useRouter();
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadTrending() {
      try {
        const res = await fetch(`${API_URL}/api/feed/trending`, { credentials: "include" });
        const data = await res.json();
        setTrending(data.trending || []);
      } catch (err) {
        console.error("Failed to load trending stories", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrending();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const heroItem = trending[0];
  const sideItems = trending.slice(1, 4);
  const secondaryItems = trending.slice(4, 7);
  const additionalItems = trending.slice(7);

  return (
    <div className="bg-paper min-h-screen text-et-headline overflow-x-hidden pb-24 md:pb-0">
      <SlideOver
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="The EconomicTimes"
        side="left"
      >
        <Sidebar />
      </SlideOver>

      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-et-border flex flex-col">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 hover:bg-et-section rounded-full transition-colors text-et-headline"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold font-serif tracking-tight text-et-headline">Explore Discovery</h1>
          </div>
          <form onSubmit={handleSearch} className="hidden md:flex relative w-80 group">
             <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-et-meta group-focus-within:text-et-red transition-colors" />
             <input 
               type="text" 
               placeholder="Search Trending Highlights" 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-et-section border border-et-border rounded-full py-2.5 pl-12 pr-4 outline-none focus:bg-white focus:border-et-red transition-all text-[14px] font-medium"
             />
          </form>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-6 py-10 flex flex-col lg:flex-row gap-10">
        <main className="flex-1 min-w-0 space-y-16">
          {loading ? (
            <div className="py-32 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-et-divider border-t-et-red rounded-full animate-spin" />
              <p className="text-et-meta font-bold uppercase tracking-widest text-xs italic">Syncing with global feeds...</p>
            </div>
          ) : (
            <>
              {/* Feature Highlights */}
              <section className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {heroItem && (
                  <div 
                    className="xl:col-span-8 group cursor-pointer space-y-6"
                    onClick={() => router.push(`/briefing/${heroItem.id}`)}
                  >
                    <div className="relative overflow-hidden bg-et-section rounded-[32px] border border-et-border aspect-[16/9] shadow-xl">
                      <SafeImage 
                        src={STOCK_PHOTO} 
                        alt="Hero" 
                        className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-1000 ease-out"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                      <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur rounded-full shadow-lg">
                        <span className="w-2 h-2 bg-et-red rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-et-headline">Essential Insight</span>
                      </div>
                    </div>
                    <div className="space-y-4 px-2">
                       <div className="flex items-center gap-3">
                         <span className="text-[12px] font-black uppercase tracking-[0.2em] text-et-red">{heroItem.category}</span>
                         <span className="w-1 h-1 bg-et-divider rounded-full" />
                         <span className="text-[12px] text-et-meta font-bold">{heroItem.count}</span>
                         <span className="w-1 h-1 bg-et-divider rounded-full" />
                         <span className="text-[12px] text-et-meta font-bold">{formatTime(heroItem.latestArticleAt)}</span>
                       </div>
                       <h2 className="text-[32px] md:text-[52px] font-serif font-black leading-[1.1] md:leading-[1] text-et-headline hover:text-et-red transition-all decoration-transparent hover:decoration-et-red underline-offset-[8px] decoration-4">
                         {heroItem.topic}
                       </h2>
                       <p className="text-[18px] text-et-secondary leading-relaxed line-clamp-2 font-medium opacity-90">
                         Decoding the latest shifts in {heroItem.topic.toLowerCase()}. A comprehensive overview of how these events reshape the global narrative.
                       </p>
                    </div>
                  </div>
                )}

                <div className="xl:col-span-4 space-y-8 xl:border-l xl:border-et-divider xl:pl-10">
                  <div className="flex items-center justify-between pb-6 border-b border-et-divider">
                    <h3 className="text-[14px] font-black uppercase tracking-[0.25em] text-et-meta">Market Stream</h3>
                    <ArrowRightIcon className="w-4 h-4 text-et-red" />
                  </div>
                  <div className="space-y-10">
                    {sideItems.map((item, i) => (
                      <div 
                        key={item.id}
                        onClick={() => router.push(`/briefing/${item.id}`)}
                        className="group cursor-pointer flex gap-5 items-start"
                      >
                        <div className="flex-1 space-y-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-et-red">{item.category}</span>
                           <h4 className="text-[18px] font-serif font-bold leading-tight text-et-headline group-hover:text-et-red transition-all">
                             {item.topic}
                           </h4>
                           <div className="flex items-center gap-2 text-[11px] text-et-meta font-bold">
                             <span>{item.count}</span>
                             <span>·</span>
                             <span>{formatTime(item.latestArticleAt)}</span>
                           </div>
                        </div>
                        <div className="w-24 h-24 bg-et-section rounded-2xl overflow-hidden shadow-md border border-et-border flex-shrink-0">
                          <SafeImage 
                            src={mediaFallbacks[i % mediaFallbacks.length]} 
                            alt="Thumb" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Ad Break */}
              <PremiumAd variant="banner" className="my-16" />

              {/* Vertical Perspective Grids */}
              <section className="space-y-10 pt-10 border-t border-et-divider">
                <div className="flex items-center justify-between">
                  <h2 className="text-[28px] font-serif font-black text-et-headline">Deep Perspectives</h2>
                  <div className="text-xs font-black uppercase tracking-widest text-et-meta cursor-pointer hover:text-et-red transition-colors flex items-center gap-2">
                    Browse All <ArrowRightIcon className="w-3 h-3" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {secondaryItems.map((item, i) => (
                    <div 
                      key={item.id}
                      onClick={() => router.push(`/briefing/${item.id}`)}
                      className="group cursor-pointer space-y-6"
                    >
                      <div className="aspect-[4/5] overflow-hidden bg-et-section rounded-[32px] border border-et-border shadow-md">
                        <SafeImage 
                          src={mediaFallbacks[(i + 3) % mediaFallbacks.length]} 
                          alt="Perspective Thumb" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="space-y-3 px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-et-red">{item.category}</span>
                          <span className="text-[10px] text-et-meta font-bold">· {formatTime(item.latestArticleAt)}</span>
                        </div>
                        <h4 className="text-[20px] font-serif font-bold leading-tight text-et-headline group-hover:text-et-red transition-colors">
                          {item.topic}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-et-secondary font-bold opacity-70">
                          <ChatBubbleLeftRightIcon className="w-4 h-4 text-et-meta" />
                          <span>Join the Briefing</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Extended Discover Stream */}
              <section className="space-y-12 py-10 border-t border-et-divider">
                 <div className="flex flex-col items-center gap-2 text-center">
                    <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-et-meta">The Global Stream</h2>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
                   {additionalItems.map((item, i) => (
                     <div 
                        key={item.id}
                        onClick={() => router.push(`/briefing/${item.id}`)}
                        className="flex gap-6 group cursor-pointer items-center"
                     >
                       <div className="w-32 h-32 md:w-40 md:h-40 bg-et-section rounded-[28px] overflow-hidden flex-shrink-0 border border-et-border shadow-sm">
                          <SafeImage 
                             src={mediaFallbacks[(i + 5) % mediaFallbacks.length]} 
                             alt="Stream" 
                             className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                       </div>
                       <div className="space-y-3">
                         <div className="text-[10px] font-black uppercase tracking-widest text-et-red">{item.category}</div>
                         <h5 className="text-[22px] font-serif font-bold leading-tight text-et-headline group-hover:text-et-red transition-all">
                           {item.topic}
                         </h5>
                         <p className="text-[13px] text-et-secondary font-medium line-clamp-2 leading-relaxed opacity-80">
                           A multifaceted look at {item.topic.toLowerCase()}, featuring insights from {item.count}.
                         </p>
                         <div className="text-[11px] text-et-meta font-bold lowercase italic">{formatTime(item.latestArticleAt)}</div>
                       </div>
                     </div>
                   ))}
                 </div>
              </section>
            </>
          )}
        </main>

        <aside className="hidden lg:block w-[360px] flex-shrink-0 space-y-10">
           <div className="sticky top-28 space-y-10 overflow-y-auto no-scrollbar pb-20">              
              <div className="bg-white p-8 rounded-[40px] border border-et-border shadow-xl space-y-6 transform hover:-translate-y-1 transition-transform">
                 <h3 className="text-2xl font-serif font-bold leading-tight text-et-headline">Search More<br/><span className="text-et-red underline decoration-2 underline-offset-4">Deep Dives</span></h3>
                 <p className="text-[15px] text-et-secondary leading-relaxed font-medium">Use our advanced search to find specific perspectives, reports, and deep dives across all categories.</p>
                 <button 
                   onClick={() => router.push("/")}
                   className="w-full py-5 bg-et-headline text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-et-red transition-all shadow-lg hover:shadow-2xl"
                 >
                   Open Search
                 </button>
              </div>

              <PremiumAd variant="sidebar" className="shadow-lg" />

              <div className="bg-white p-8 rounded-[40px] border border-et-border shadow-sm">
                 <h4 className="text-xs font-black uppercase tracking-widest text-et-meta mb-4">Discovery Tips</h4>
                 <ul className="space-y-4 text-sm font-bold text-et-headline">
                    <li className="flex gap-2 items-start"><span className="text-et-red">·</span> Follow stories for live updates</li>
                    <li className="flex gap-2 items-start"><span className="text-et-red">·</span> Browse individual authors</li>
                    <li className="flex gap-2 items-start"><span className="text-et-red">·</span> Explore deep dive series</li>
                 </ul>
              </div>
           </div>
        </aside>
      </div>

      <footer className="bg-white border-t border-et-border py-24 mt-20">
         <div className="max-w-[1440px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-16 border-b border-et-divider pb-20">
            <div className="space-y-8">
               <div className="text-3xl font-black font-serif tracking-tighter">NAV<span className="text-et-red">IGATOR</span></div>
               <p className="text-[15px] text-et-secondary leading-relaxed font-medium">Delivering progressive news with a focus on deep insights and historical context. The future of informed reading.</p>
            </div>
            <div className="space-y-6">
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-et-meta">Hubs</h4>
               <ul className="space-y-4 text-[15px] font-bold text-et-headline">
                  <li className="hover:text-et-red cursor-pointer flex items-center gap-2">Discovery <div className="w-1 h-1 bg-et-red rounded-full" /></li>
                  <li className="hover:text-et-red cursor-pointer">Trending Stories</li>
                  <li className="hover:text-et-red cursor-pointer">Global Stream</li>
               </ul>
            </div>
            <div className="space-y-6">
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-et-meta">Support</h4>
               <ul className="space-y-4 text-[15px] font-bold text-et-headline">
                  <li className="hover:text-et-red cursor-pointer">Terms & Conditions</li>
                  <li className="hover:text-et-red cursor-pointer">Privacy Framework</li>
                  <li className="hover:text-et-red cursor-pointer">Accessibility</li>
               </ul>
            </div>
            <div className="space-y-8">
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-et-meta">Stay Connected</h4>
               <div className="flex gap-2">
                  <input type="text" placeholder="Updates by email" className="bg-et-section border border-et-border rounded-2xl px-5 py-3 text-sm flex-1 outline-none focus:border-et-red" />
                  <button className="bg-et-red text-white p-3 rounded-2xl shadow-lg hover:rotate-12 transition-transform"><ArrowRightIcon className="w-5 h-5" /></button>
               </div>
            </div>
         </div>
         <div className="max-w-[1440px] mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6 text-[11px] font-black uppercase tracking-[0.3em] text-et-meta italic">
            <span>© 2026 THE ECONOMIC TIMES NAVIGATOR SYSTEM</span>
            <div className="flex gap-10">
               <span className="hover:text-et-red cursor-pointer cursor-not-allowed opacity-50">Legal</span>
               <span className="hover:text-et-red cursor-pointer cursor-not-allowed opacity-50">Sitemap</span>
               <span className="hover:text-et-red cursor-pointer cursor-not-allowed opacity-50">Cookies</span>
            </div>
         </div>
      </footer>
    </div>
  );
}
