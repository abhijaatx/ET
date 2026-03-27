"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Clock, 
  Users, 
  AlertTriangle, 
  Zap,
  ArrowRight,
  ShieldCheck,
  Star,
  Info
} from "lucide-react";

export type StoryArcData = {
  story_id: string;
  timeline: { date: string; event: string; article_id: string; impact_level: "low" | "medium" | "high"; author?: string }[];
  players: { name: string; role: string; stance: string; influence_score: number }[];
  contrarian_views: { perspective: string; source_article_id: string; strength: "moderate" | "significant"; author?: string }[];
  predictions: { scenario: string; probability: string; trigger: string }[];
  labels?: { 
    timeline_title: string; 
    players_title: string; 
    contrarian_title: string; 
    outlook_title: string;
    impact_suffix: string;
    trigger_label: string;
  };
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
  
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className="space-y-10 pb-12 px-2 max-w-full overflow-x-hidden"
    >
      {/* 1. Timeline Section */}
      <motion.section variants={sectionVariants}>
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 shadow-sm">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900 uppercase">
              {data.labels?.timeline_title || "Event Horizon"}
            </h2>
          </div>
        </div>
        
        <div className="relative pl-10 space-y-6 before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-red-200 before:via-orange-100 before:to-slate-100">
          {data.timeline.map((item, idx) => (
            <motion.div 
              key={idx}
              variants={cardVariants}
              className="relative group cursor-pointer"
              onClick={() => onArticleClick?.(item.article_id)}
            >
              <div className={`absolute -left-[30px] top-1 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center transition-all duration-500 z-10 ${
                item.impact_level === 'high' ? 'border-red-600 scale-110 shadow-md' : 'border-slate-300 group-hover:border-red-400'
              }`}>
                {item.impact_level === 'high' ? <Star className="w-2.5 h-2.5 text-red-600 fill-red-600" /> : <div className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-red-400" />}
              </div>
              
              <div className={`p-5 md:p-6 rounded-2xl transition-all duration-500 border ${
                item.impact_level === 'high' 
                  ? 'bg-gradient-to-br from-white to-red-50/10 border-red-100 shadow-sm' 
                  : 'bg-white border-slate-100 hover:border-red-200 hover:shadow-sm'
              }`}>
                <div className="text-[9px] font-black text-red-500/60 uppercase tracking-widest mb-2 flex items-center justify-between" >
                  <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  {item.author && <span className="opacity-40 italic">BY {item.author}</span>}
                </div>
                <p className={`text-base md:text-lg leading-snug ${item.impact_level === 'high' ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                  {item.event}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full border shadow-sm ${
                    item.impact_level === 'high' ? 'bg-red-600 border-red-700 text-white' : 
                    item.impact_level === 'medium' ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}>
                    {item.impact_level} {data.labels?.impact_suffix || "Impact"}
                  </span>
                  <span className="text-[9px] font-black text-slate-400 group-hover:text-red-600 transition-colors uppercase tracking-widest flex items-center gap-1">
                    ANALYZE SOURCE <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* 2. Stakeholder Section */}
      <motion.section variants={sectionVariants}>
        <div className="flex items-center gap-2 mb-6 px-2">
          <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 shadow-sm">
            <Users className="w-4 h-4" />
          </div>
          <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900 uppercase">
            {data.labels?.players_title || "Stakeholder Map"}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.players.sort((a,b) => b.influence_score - a.influence_score).map((player, idx) => (
            <motion.div 
              key={idx} 
              variants={cardVariants}
              whileHover={{ y: -4 }}
              className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm relative overflow-hidden group transition-all"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-0.5">
                    <h3 className="font-black text-slate-900 leading-tight text-base">{player.name}</h3>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{player.role}</p>
                  </div>
                  {player.influence_score > 0.8 && <ShieldCheck className="w-4 h-4 text-red-600" />}
                </div>
                <div className="text-sm text-slate-600 leading-normal italic bg-slate-50 p-4 rounded-xl border border-slate-100 flex-1">
                  "{player.stance}"
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* 4. Outlook & Dissent Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.section variants={sectionVariants}>
          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 shadow-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900 uppercase">
              {data.labels?.contrarian_title || "Contrarian Views"}
            </h2>
          </div>
          <div className="space-y-4">
            {data.contrarian_views.map((c, idx) => (
              <motion.div 
                key={idx} 
                variants={cardVariants}
                whileHover={{ x: 4 }}
                className="p-5 rounded-2xl border-l-4 border border-slate-100 bg-white shadow-sm relative transition-all border-l-red-600"
              >
                <p className="text-base font-bold text-slate-800 leading-snug italic pr-4">
                  "{c.perspective}"
                </p>
                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-red-600">Minority Report</span>
                    {c.author && <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-60 ml-2">BY {c.author}</span>}
                  </div>
                  <button 
                    onClick={() => onArticleClick?.(c.source_article_id)}
                    className="text-[9px] font-black text-slate-900 hover:text-red-600 border-b border-slate-900 hover:border-red-600 transition-all uppercase tracking-widest flex items-center gap-1"
                  >
                    INVESTIGATE <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={sectionVariants}>
          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 shadow-sm">
              <Zap className="w-4 h-4 fill-red-600" />
            </div>
            <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900 uppercase">
              {data.labels?.outlook_title || "Forward Outlook"}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {data.predictions.map((p, idx) => (
              <motion.div 
                key={idx} 
                variants={cardVariants}
                className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-50/20 rounded-full translate-x-8 -translate-y-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                        p.probability === 'High' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {p.probability} Probability
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight mb-4 pr-6">{p.scenario}</h3>
                  </div>
                  <div className="bg-red-50/30 p-4 rounded-xl border border-red-100/50">
                    <div className="flex items-center gap-2 mb-2">
                       <motion.div 
                        animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(226,27,34,0.3)]" 
                       />
                       <span className="text-[9px] font-black uppercase tracking-widest text-red-600 flex items-center gap-1">
                         {data.labels?.trigger_label || "Critical Trigger"} <Info className="w-2.5 h-2.5" />
                       </span>
                    </div>
                    <p className="text-xs text-slate-700 font-bold leading-normal">{p.trigger}</p>
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
