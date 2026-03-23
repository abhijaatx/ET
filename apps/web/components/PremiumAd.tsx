"use client";

import { motion } from "framer-motion";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";

interface PremiumAdProps {
  variant: "sidebar" | "feed" | "banner";
  title?: string;
  description?: string;
  image?: string;
  cta?: string;
  className?: string;
}

const STOCK_ADS = {
  premium: {
    title: "Unleash Your Economic Edge",
    description: "Get exclusive insights, deep-dive reports, and expert analysis with ET Premium.",
    image: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg",
    cta: "Explore Premium"
  },
  wealth: {
    title: "Master Your Portfolio",
    description: "Advanced terminal tools and real-time market signals for the modern investor.",
    image: "https://images.pexels.com/photos/7841311/pexels-photo-7841311.jpeg",
    cta: "Join Wealth"
  }
};

export function PremiumAd({ 
  variant, 
  title, 
  description, 
  image, 
  cta, 
  className = "" 
}: PremiumAdProps) {
  const ad = STOCK_ADS.premium; // Default to premium for now
  const displayTitle = title || ad.title;
  const displayDesc = description || ad.description;
  const displayImage = image || ad.image;
  const displayCta = cta || ad.cta;

  if (variant === "sidebar") {
    return (
      <motion.div 
        whileHover={{ y: -4 }}
        className={`bg-white rounded-[2.5rem] overflow-hidden border border-et-border shadow-xl ${className}`}
      >
        <div className="h-48 overflow-hidden relative">
          <img src={displayImage} alt="Ad" className="w-full h-full object-cover" />
          <div className="absolute top-4 left-4 px-3 py-1 bg-et-red text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
            Sponsored
          </div>
        </div>
        <div className="p-8 space-y-4">
          <h3 className="text-xl font-serif font-black text-et-headline leading-tight">
            {displayTitle}
          </h3>
          <p className="text-xs text-et-secondary leading-relaxed font-medium opacity-80">
            {displayDesc}
          </p>
          <button className="w-full py-4 bg-et-headline text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-et-red transition-all flex items-center justify-center gap-2 group">
            {displayCta}
            <ArrowUpRightIcon className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </button>
        </div>
      </motion.div>
    );
  }

  if (variant === "banner") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={`bg-white rounded-[2.5rem] border border-et-border p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm hover:shadow-md transition-all ${className}`}
      >
        <div className="w-full md:w-48 h-32 md:h-24 rounded-2xl overflow-hidden shrink-0">
          <img src={displayImage} alt="Ad" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 space-y-2 text-center md:text-left">
          <div className="text-[10px] font-black uppercase tracking-widest text-et-red mb-1">Sponsored Discovery</div>
          <h3 className="text-xl font-serif font-black text-et-headline">{displayTitle}</h3>
          <p className="text-sm text-et-secondary font-medium opacity-70 italic">{displayDesc}</p>
        </div>
        <button className="px-8 py-3 bg-et-section border border-et-border rounded-full text-[10px] font-black uppercase tracking-widest text-et-headline hover:bg-et-red hover:text-white transition-all whitespace-nowrap">
          {displayCta}
        </button>
      </motion.div>
    );
  }

  // Feed variant (matches ArticleCard)
  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      className={`bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-et-border shadow-sm flex flex-col md:flex-row gap-8 items-center group cursor-pointer hover:border-et-red/20 transition-all ${className}`}
    >
      <div className="w-full md:w-64 h-48 rounded-3xl overflow-hidden bg-et-section shrink-0 relative">
        <img src={displayImage} alt="Ad" className="w-full h-full object-cover" />
        <div className="absolute top-4 left-4 px-3 py-1 bg-et-red text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">
          Promoted
        </div>
      </div>
      <div className="flex-1 space-y-4">
        <div className="space-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-et-red">ET Discovery Partner</div>
          <h3 className="text-2xl font-serif font-black text-et-headline group-hover:text-et-red transition-colors leading-tight">
            {displayTitle}
          </h3>
        </div>
        <p className="text-sm text-et-body leading-relaxed line-clamp-2 opacity-70 italic font-serif">
          "{displayDesc}"
        </p>
        <div className="flex items-center gap-4 pt-2">
           <button className="px-6 py-2 bg-et-headline text-white rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-et-red transition-all">
             {displayCta}
           </button>
           <span className="text-[10px] font-bold text-et-meta uppercase tracking-widest opacity-40 italic">Economic Times Verified Partner</span>
        </div>
      </div>
    </motion.div>
  );
}
