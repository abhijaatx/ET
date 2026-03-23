"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  UserCircleIcon, 
  ChevronRightIcon, 
  ArrowUpRightIcon,
  ClockIcon,
  BookOpenIcon,
  FireIcon,
  StarIcon,
  BellIcon,
  Bars3Icon,
  HashtagIcon,
  BookmarkIcon
} from "@heroicons/react/24/outline";
import { Sidebar } from "../../components/Sidebar";
import { SlideOver } from "../../components/SlideOver";
import { PremiumAd } from "../../components/PremiumAd";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface DashboardData {
  user: {
    email: string;
    name: string;
    subscription: {
      plan: string;
      status: string;
      nextBilling: string;
    };
  };
  stats: {
    articlesRead: number;
    timeSpentMins: number;
    engagementScore: number;
    authorsFollowed: number;
    storiesFollowed: number;
  };
  topics: { name: string; weight: number }[];
  followedAuthors: { id: string; name: string; handle: string; avatarUrl: string | null }[];
  followedStories: { id: string; headline: string; articleCount: number }[];
  dailyEngagement: { day: string; score: number }[];
}

export default function ProfilePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/user/stats`, { credentials: "include" })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load profile data");
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-12 h-12 border-4 border-et-divider border-t-et-red rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper p-4 text-center">
        <h2 className="text-xl font-bold text-et-headline mb-4">Oops! {error}</h2>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-et-red text-white rounded-full font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const points = data.dailyEngagement.map((d, i) => `${i * 100},${100 - (d.score * 0.8)}`).join(" ");
  const curvePath = `M ${points}`;

  return (
    <div className="min-h-screen bg-et-section pb-24 md:pb-0">
      <header className="md:hidden bg-white/90 backdrop-blur-md border-b border-et-divider px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
         <div className="text-xl font-serif font-black tracking-tight">NAV<span className="text-et-red">IGATOR</span></div>
         <button 
           onClick={() => setIsDrawerOpen(true)}
           className="p-2 hover:bg-et-section rounded-full transition-colors text-et-headline"
         >
           <Bars3Icon className="w-6 h-6" />
         </button>
      </header>
      
      <SlideOver
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="The EconomicTimes"
        side="left"
      >
        <Sidebar />
      </SlideOver>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 px-4 py-8">
        {/* Main Content */}
        <main className="flex-1 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-red-100 flex flex-col md:flex-row items-center gap-6 md:gap-8 shadow-sm"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-et-red to-[#B01722] flex items-center justify-center text-white text-3xl font-serif font-bold shadow-lg border-4 border-white">
                {data.user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-serif font-bold text-et-headline mb-1">{data.user.name}</h1>
                <p className="text-et-secondary mb-4 font-sans text-sm">{data.user.email}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="px-3 py-1 bg-et-red/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-et-red border border-et-red/20 shadow-sm">
                    {data.stats.engagementScore}% Intensity
                  </div>
                  <div className="px-3 py-1 bg-indigo-50 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#1A2B3C] border border-indigo-100 shadow-sm">
                    Trusted Reader
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#1A2B3C] rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#E5C100] opacity-80">Membership</span>
                  <div className="p-2 bg-white/10 rounded-xl"><StarIcon className="w-5 h-5 text-[#E5C100]" /></div>
                </div>
                <h2 className="text-2xl font-serif font-bold mb-1 bg-gradient-to-r from-white to-[#E5C100] bg-clip-text text-transparent">{data.user.subscription.plan}</h2>
                <p className="text-xs opacity-50 mb-8">Next renewal on {data.user.subscription.nextBilling}</p>
                <button className="w-full py-3 bg-[#E5C100] hover:bg-[#D4B000] text-[#1A2B3C] rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 group">
                  Upgrade Account
                  <ArrowUpRightIcon className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-et-red/20 rounded-full blur-3xl" />
            </motion.div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Articles", value: data.stats.articlesRead, icon: BookOpenIcon, color: "bg-blue-50 text-blue-600", border: "border-blue-100", href: "/profile/articles" },
              { label: "Focus", value: `${data.stats.timeSpentMins}m`, icon: ClockIcon, color: "bg-orange-50 text-orange-600", border: "border-orange-100", href: "/profile/focus" },
              { label: "Authors", value: data.stats.authorsFollowed, icon: UserCircleIcon, color: "bg-purple-50 text-purple-600", border: "border-purple-100", href: "/profile/authors" },
              { label: "Stories", value: data.stats.storiesFollowed, icon: FireIcon, color: "bg-red-50 text-et-red", border: "border-red-100", href: "/profile/stories" }
            ].map((stat, i) => (
              <Link key={stat.label} href={stat.href}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.05 }} className={`bg-white rounded-3xl p-6 border ${stat.border} shadow-sm hover:shadow-md h-full transition-all group`}>
                  <div className={`p-3 rounded-2xl w-fit mb-4 group-hover:scale-110 duration-300 ${stat.color}`}><stat.icon className="w-6 h-6" /></div>
                  <div className="text-2xl font-serif font-bold text-et-headline">{stat.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-et-meta mt-1">{stat.label}</div>
                </motion.div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-3xl p-8 border border-red-100 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div><h3 className="text-lg font-serif font-bold text-et-headline">News Engagement</h3><p className="text-[10px] font-bold uppercase tracking-wider text-et-meta">7-Day Intensity</p></div>
                <div className="bg-green-50 px-2 py-1 rounded text-green-700 text-[10px] font-bold flex items-center gap-1">+12.5% <ArrowUpRightIcon className="w-3 h-3" /></div>
              </div>
              <div className="h-[180px] w-full relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 100">
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#E21B22" stopOpacity="0.2" /><stop offset="100%" stopColor="#E21B22" stopOpacity="0" /></linearGradient>
                    <filter id="glow"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2 }} d={`${curvePath} L 600,100 L 0,100 Z`} fill="url(#gradient)" />
                  <motion.path initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 2 }} d={curvePath} fill="none" stroke="#E21B22" strokeWidth="3" filter="url(#glow)" />
                  {data.dailyEngagement.map((d, i) => (
                    <motion.circle key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 + i * 0.1 }} cx={i * 100} cy={100 - (d.score * 0.8)} r="4" fill="white" stroke="#E21B22" strokeWidth="2" />
                  ))}
                </svg>
                <div className="flex justify-between mt-6 px-2">{data.dailyEngagement.map(d => (<span key={d.day} className="text-[10px] text-et-meta font-bold uppercase tracking-tighter">{d.day}</span>))}</div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-3xl p-8 border border-indigo-50 shadow-sm">
              <h3 className="text-lg font-serif font-bold text-et-headline mb-6">Topic Affinity</h3>
              <div className="space-y-5">
                {data.topics.map((topic, i) => (
                  <div key={topic.name} className="space-y-2">
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-[#1A2B3C]"><span>{topic.name}</span><span className="opacity-40">{Math.round(topic.weight * 100)}%</span></div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${topic.weight * 100}%` }} transition={{ duration: 1.2, delay: 0.6 + i * 0.1 }} className={`h-full rounded-full ${["bg-et-red", "bg-[#1A2B3C]", "bg-orange-500", "bg-indigo-400", "bg-emerald-500"][i % 5]}`} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <PremiumAd variant="banner" className="my-10" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
             <div className="space-y-4">
               <h3 className="text-lg font-serif font-bold text-et-headline px-2">Followed Authors</h3>
               <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 px-1">
                 {data.followedAuthors.map(author => (
                   <div key={author.id} className="min-w-[120px] bg-white rounded-2xl p-4 border border-et-divider text-center shadow-sm">
                     <div className="w-16 h-16 rounded-full bg-et-section mx-auto mb-3 overflow-hidden border-2 border-white">
                        {author.avatarUrl ? <img src={author.avatarUrl} alt={author.name} className="w-full h-full object-cover" /> : <UserCircleIcon className="w-full h-full text-et-divider" />}
                     </div>
                     <div className="text-[11px] font-bold truncate">{author.name}</div>
                   </div>
                 ))}
               </div>
             </div>
             <div className="space-y-4">
               <h3 className="text-lg font-serif font-bold text-et-headline px-2">Followed Stories</h3>
               <div className="space-y-3">
                 {data.followedStories.map(story => (
                   <div key={story.id} className="bg-white rounded-2xl p-5 border border-et-divider flex justify-between items-center group cursor-pointer hover:shadow-md transition-all">
                     <div><div className="text-sm font-serif font-bold group-hover:text-et-red">{story.headline}</div><div className="text-[10px] font-bold text-et-meta uppercase tracking-widest mt-1 opacity-60">{story.articleCount} Current Insights</div></div>
                     <div className="p-2 bg-et-section rounded-xl group-hover:bg-et-red group-hover:text-white transition-all"><ChevronRightIcon className="w-4 h-4" /></div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </main>

        <aside className="hidden xl:block w-72 space-y-6">
           <div className="bg-white rounded-3xl p-6 border border-et-border shadow-sm sticky top-8">
             <h4 className="text-xs font-bold text-et-meta uppercase tracking-widest mb-6">Quick Actions</h4>
             <div className="space-y-2">
               {[
                 { label: "Notifications", icon: BellIcon, count: 3, href: "/notifications" },
                 { label: "Preferences", icon: HashtagIcon, href: "/preferences" },
                 { label: "Bookmarks", icon: BookmarkIcon, href: "/bookmarks" }
               ].map((action) => (
                 <Link key={action.label} href={action.href}>
                   <button className="w-full flex items-center justify-between p-3 hover:bg-et-section rounded-xl transition-all text-sm group text-left">
                     <div className="flex items-center gap-3 text-et-body font-medium group-hover:text-et-red transition-colors">
                       <action.icon className="w-5 h-5 opacity-60" />
                       {action.label}
                     </div>
                     {action.count && <span className="bg-et-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{action.count}</span>}
                   </button>
                 </Link>
               ))}
             </div>
           </div>
        </aside>
      </div>
    </div>
  );
}
