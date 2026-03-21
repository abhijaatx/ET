"use client";

import { motion } from "framer-motion";

type ArticleCardProps = {
  title: string;
  source: string;
  time: string;
  topic: string;
  readTime: string;
  onClick: () => void;
};

export function ArticleCard({ title, source, time, topic, readTime, onClick }: ArticleCardProps) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full rounded-3xl border border-mist bg-white/80 p-6 text-left shadow-soft transition hover:-translate-y-1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate">
        <span>{source}</span>
        <span className="h-1 w-1 rounded-full bg-accent" />
        <span>{time}</span>
      </div>
      <h3 className="mt-3 font-display text-2xl leading-snug">{title}</h3>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate">
        <span className="rounded-full bg-mist px-3 py-1 text-ink">{topic}</span>
        <span>{readTime}</span>
      </div>
    </motion.button>
  );
}
