"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Clock, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Zap,
  ArrowRight,
  ShieldCheck,
  Star,
  Info,
  Activity,
  BarChart3
} from "lucide-react";

export type StoryArcData = {
  story_id: string;
  timeline: { date: string; event: string; article_id: string; impact_level: "low" | "medium" | "high" }[];
  players: { name: string; role: string; stance: string; influence_score: number }[];
  sentiment_matrix: {
    narrative: { date: string; score: number; label: string }[];
    market: { date: string; score: number; label: string }[];
  };
  contrarian_views: { perspective: string; source_article_id: string; strength: "moderate" | "significant" }[];
  predictions: { scenario: string; probability: string; trigger: string }[];
};

interface BriefingStoryArcProps {
  data: StoryArcData;
  onArticleClick?: (id: string) => void;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 100 } }
};

export function BriefingStoryArc({ data, onArticleClick }: BriefingStoryArcProps) {
  
  const generatePath = (pointsArray: { score: number }[]) => {
    if (!pointsArray.length) return "";
    const width = 1000;
    const height = 150;
    const padding = 50;
    const points = pointsArray.map((s, i) => {
      const x = padding + (i * (width - 2 * padding)) / (pointsArray.length - 1);
      const y = height / 2 - (s.score * (height / 2 - 40));
      return { x, y };
    });

    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cp1x = (points[i].x + points[i + 1].x) / 2;
      d += ` C ${cp1x} ${points[i].y}, ${cp1x} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
    return d;
  };

  const narrativePath = useMemo(() => generatePath(data.sentiment_matrix?.narrative || []), [data.sentiment_matrix?.narrative]);
  const marketPath = useMemo(() => generatePath(data.sentiment_matrix?.market || []), [data.sentiment_matrix?.market]);

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className="space-y-16 pb-20 px-2 max-w-full overflow-x-hidden"
    >
      {/* 1. Timeline Section */}
      <motion.section variants={sectionVariants}>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Event Horizon</h2>
          </div>
        </div>
        
        <div className="relative pl-10 md:pl-12 space-y-12 before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-1 before:bg-gradient-to-b before:from-red-200 before:via-orange-100 before:to-slate-100">
          {data.timeline.map((item, idx) => (
            <motion.div 
              key={idx}
              variants={cardVariants}
              className="relative group cursor-pointer"
              onClick={() => onArticleClick?.(item.article_id)}
            >
              <div className={`absolute -left-[41px] top-1.5 w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center transition-all duration-500 z-10 ${
                item.impact_level === 'high' ? 'border-red-600 scale-125 shadow-lg' : 'border-slate-300 group-hover:border-red-400'
              }`}>
                {item.impact_level === 'high' ? <Star className="w-3 h-3 text-red-600 fill-red-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-red-400" />}
              </div>
              
              <div className={`p-6 md:p-8 rounded-[2rem] transition-all duration-500 border ${
                item.impact_level === 'high' 
                  ? 'bg-gradient-to-br from-white to-red-50/20 border-red-100 shadow-soft-xl scale-[1.01]' 
                  : 'bg-white border-slate-100 hover:border-red-200 hover:shadow-soft'
              }`}>
                <div className="text-[10px] font-black text-red-500/60 uppercase tracking-widest mb-3">
                  {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <p className={`text-lg md:text-xl leading-relaxed ${item.impact_level === 'high' ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                  {item.event}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-full border shadow-sm ${
                    item.impact_level === 'high' ? 'bg-red-600 border-red-700 text-white' : 
                    item.impact_level === 'medium' ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}>
                    {item.impact_level} Impact
                  </span>
                  <span className="text-[10px] font-black text-slate-400 group-hover:text-red-600 transition-colors uppercase tracking-[0.2em] flex items-center gap-1">
                    ANALYZE SOURCE <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* 2. Stakeholder Section */}
      <motion.section variants={sectionVariants}>
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Stakeholder Map</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.players.sort((a,b) => b.influence_score - a.influence_score).map((player, idx) => (
            <motion.div 
              key={idx} 
              variants={cardVariants}
              whileHover={{ y: -8 }}
              className="p-8 rounded-[2.5rem] border border-slate-100 bg-white shadow-soft relative overflow-hidden group transition-all"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-900 leading-tight text-lg">{player.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{player.role}</p>
                  </div>
                  {player.influence_score > 0.8 && <ShieldCheck className="w-5 h-5 text-red-600" />}
                </div>
                <div className="text-sm text-slate-600 leading-relaxed italic bg-paper p-5 rounded-[1.5rem] border border-mist flex-1">
                  "{player.stance}"
                </div>
                <div className="mt-8">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    <span>Power Index</span>
                    <span className="text-slate-900">{Math.round(player.influence_score * 100)}%</span>
                  </div>
                  <div className="w-full bg-mist/30 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${player.influence_score * 100}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="bg-red-600 h-full rounded-full shadow-sm shadow-red-200"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* 3. Sentiment Section - DUAL LAYERED */}
      <motion.section variants={sectionVariants}>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Sentiment Strategy</h2>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Narrative</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Market</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-mist shadow-soft relative overflow-hidden group">
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-100" />
          <div className="absolute top-8 left-12 text-[9px] font-black text-emerald-600/40 uppercase tracking-[0.2em] flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Bullish Bias</div>
          <div className="absolute bottom-8 left-12 text-[9px] font-black text-red-600/40 uppercase tracking-[0.2em] flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Bearish Bias</div>

          <div className="w-full overflow-x-auto no-scrollbar">
            <div className="min-w-[800px] h-64 relative">
              <svg viewBox="0 0 1000 150" className="w-full h-full drop-shadow-sm relative z-10">
                {/* Narrative Wave */}
                <motion.path
                  d={narrativePath}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="1, 8"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.8 }}
                  transition={{ duration: 2 }}
                />
                <motion.path
                  d={narrativePath}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2.5 }}
                />
                {/* Market Wave */}
                <motion.path
                  d={marketPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2.2, delay: 0.3 }}
                />
              </svg>
              
              {/* Divergence Highlights (Logic: Simple overlap detection visually or just placing nodes) */}
              <div className="flex justify-between mt-4 px-12">
                {(data.sentiment_matrix?.market || []).map((s, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-3 group relative">
                    <div className="relative">
                      <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm absolute -translate-x-1/2 -top-1 ${s.score > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div className="w-px h-12 bg-slate-100 mt-2" />
                    </div>
                    <div className="text-center group-hover:scale-110 transition-transform">
                      <div className="text-[10px] font-black text-slate-900 leading-tight uppercase tracking-tighter w-20">{s.label}</div>
                      <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 4. Outlook & Dissent Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <motion.section variants={sectionVariants}>
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Contrarian Views</h2>
          </div>
          <div className="space-y-6">
            {data.contrarian_views.map((c, idx) => (
              <motion.div 
                key={idx} 
                variants={cardVariants}
                whileHover={{ scale: 1.02, x: 5 }}
                className="p-8 rounded-[2.5rem] border-l-8 border border-mist bg-white shadow-soft relative transition-all border-l-red-600"
              >
                <p className="text-lg font-bold text-slate-800 leading-relaxed italic pr-4">
                  "{c.perspective}"
                </p>
                <div className="mt-8 pt-6 border-t border-mist/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">Minority Report</span>
                  </div>
                  <button 
                    onClick={() => onArticleClick?.(c.source_article_id)}
                    className="text-[10px] font-black text-slate-900 hover:text-red-600 border-b-2 border-slate-900 hover:border-red-600 transition-all uppercase tracking-widest flex items-center gap-1"
                  >
                    INVESTIGATE <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={sectionVariants}>
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
              <Zap className="w-5 h-5 fill-indigo-600" />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Forward Outlook</h2>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {data.predictions.map((p, idx) => (
              <motion.div 
                key={idx} 
                variants={cardVariants}
                className="p-8 rounded-[2.5rem] border border-indigo-100 bg-white shadow-soft-xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full translate-x-12 -translate-y-12 transition-transform group-hover:scale-110" />
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                        p.probability === 'High' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {p.probability} Probability
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight mb-6 pr-8">{p.scenario}</h3>
                  </div>
                  <div className="bg-indigo-50/50 p-6 rounded-[1.5rem] border border-indigo-100/50">
                    <div className="flex items-center gap-3 mb-3">
                       <motion.div 
                        animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.4)]" 
                       />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-1">
                         Critical Trigger <Info className="w-3 h-3" />
                       </span>
                    </div>
                    <p className="text-sm text-slate-700 font-bold leading-relaxed">{p.trigger}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
