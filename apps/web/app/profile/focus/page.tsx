"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowLeftIcon, 
  ClockIcon, 
  ArrowUpRightIcon,
  ChartBarIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface FocusDay {
  date: string;
  totalSeconds: number;
}

export default function FocusTimePage() {
  const [focusData, setFocusData] = useState<FocusDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/user/focus`, { credentials: "include" })
      .then(res => res.json())
      .then(data => setFocusData(data.focusData || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalMinutes = Math.round(focusData.reduce((acc, curr) => acc + curr.totalSeconds, 0) / 60);
  const avgMinutes = focusData.length > 0 ? Math.round(totalMinutes / focusData.length) : 0;

  // Max value for chart scaling
  const maxSeconds = Math.max(...focusData.map(d => d.totalSeconds), 1);

  return (
    <div className="min-h-screen bg-et-section p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/profile">
            <button className="flex items-center gap-2 text-et-meta font-bold hover:text-et-red transition-colors">
              <ArrowLeftIcon className="w-4 h-4" />
              BACK TO PROFILE
            </button>
          </Link>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-et-red italic">Engagement Metrics</div>
        </div>

        <header className="space-y-2">
          <h1 className="text-4xl font-serif font-black text-et-headline">Focus Time</h1>
          <p className="text-et-secondary font-medium italic opacity-60">Quantifying your intellectual commitment to the economy.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-et-border shadow-sm flex flex-col justify-center">
             <div className="text-[10px] font-black uppercase tracking-widest text-et-meta mb-2">Total Depth</div>
             <div className="text-5xl font-serif font-black text-et-headline">{totalMinutes}m</div>
             <div className="text-[10px] font-bold text-et-red mt-2 uppercase tracking-widest">Lifetime Focus</div>
           </div>
           <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-et-border shadow-sm flex flex-col justify-center">
             <div className="text-[10px] font-black uppercase tracking-widest text-et-meta mb-2">Daily Intensity</div>
             <div className="text-5xl font-serif font-black text-et-headline">{avgMinutes}m</div>
             <div className="text-[10px] font-bold text-et-red mt-2 uppercase tracking-widest">Average Focus</div>
           </div>
           <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-et-border shadow-sm flex flex-col justify-center">
             <div className="text-[10px] font-black uppercase tracking-widest text-et-meta mb-2">Streak</div>
             <div className="text-5xl font-serif font-black text-et-headline">12d</div>
             <div className="text-[10px] font-bold text-et-red mt-2 uppercase tracking-widest">Growth Vector</div>
           </div>
        </div>

        {/* Chart Card */}
        <div className="bg-white/80 backdrop-blur-md rounded-[3rem] p-10 border border-et-border shadow-md">
           <div className="flex justify-between items-start mb-12">
             <div className="space-y-1">
               <h3 className="text-2xl font-serif font-bold text-et-headline flex items-center gap-3">
                 <ChartBarIcon className="w-6 h-6 text-et-red" />
                 Focused Engagement
               </h3>
               <p className="text-xs text-et-meta font-bold uppercase tracking-widest opacity-60">Last 30 Days Trend</p>
             </div>
             <div className="px-4 py-1.5 bg-green-50 rounded-full text-green-700 text-[10px] font-black tracking-widest flex items-center gap-1.5 uppercase">
               Performance +12% <SparklesIcon className="w-3.5 h-3.5" />
             </div>
           </div>

           <div className="h-[300px] w-full flex items-end gap-3 px-4">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center italic text-et-meta">Calibrating metrics...</div>
              ) : focusData.length > 0 ? (
                focusData.map((day, i) => (
                  <motion.div 
                    key={day.date}
                    initial={{ height: 0 }}
                    animate={{ height: `${(day.totalSeconds / maxSeconds) * 100}%` }}
                    transition={{ delay: i * 0.02, duration: 1, ease: "circOut" }}
                    className="flex-1 bg-gradient-to-t from-et-red to-[#FF4D4D] rounded-t-xl relative group"
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-et-headline text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                       {Math.round(day.totalSeconds / 60)}m
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="w-full h-full flex items-center justify-center italic text-et-meta">No activity data yet. Start reading to see trends.</div>
              )}
           </div>
           
           <div className="flex justify-between mt-8 px-4 text-[9px] font-black text-et-meta uppercase tracking-tighter opacity-40">
              <span>{focusData[focusData.length - 1]?.date || ""}</span>
              <span className="flex-1 border-b border-et-divider border-dashed mb-1 mx-4" />
              <span>{focusData[0]?.date || ""}</span>
           </div>
        </div>

        <div className="bg-[#1A2B3C] rounded-[2.5rem] p-10 text-white flex items-center justify-between border border-white/10 shadow-2xl">
           <div className="space-y-4">
              <h4 className="text-xl font-serif font-bold">Earn Subscription Credits</h4>
              <p className="text-xs opacity-60 max-w-md font-medium leading-relaxed">
                Consistent focus on high-quality analysis earns you "Trusted Reader" credits, which can be redeemed for ET Premium extensions.
              </p>
           </div>
           <button className="px-8 py-3 bg-white text-[#1A2B3C] rounded-full font-black text-xs uppercase tracking-widest hover:bg-et-red hover:text-white transition-all">
              Redeem Credits
           </button>
        </div>
      </div>
    </div>
  );
}
