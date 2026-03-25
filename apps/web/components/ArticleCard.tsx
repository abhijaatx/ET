"use client";

import { formatDistanceToNow } from "date-fns";
import { 
  HeartIcon as HeartIconOutline, 
  ShareIcon,
  BookmarkIcon as BookmarkIconOutline
} from "@heroicons/react/24/outline";
import { 
  HeartIcon as HeartIconSolid, 
  BookmarkIcon as BookmarkIconSolid 
} from "@heroicons/react/24/solid";
import { useState } from "react";
import { useAuthorProfile } from "../context/AuthorProfileContext";

type Article = {
  id: string;
  title: string;
  summary: string;
  source: string;
  author?: string | null;
  authorId?: string | null;
  publishedAt: string;
  topicSlugs: string[];
  storyId?: string | null;
  isLiked?: boolean;
  isBookmarked?: boolean;
  imageUrl?: string | null;
};

type ArticleCardProps = {
  article: Article;
  onClick: (article: Article) => void;
};

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  const { openProfile } = useAuthorProfile();
  const [liked, setLiked] = useState(article.isLiked ?? false);
  const [bookmarked, setBookmarked] = useState(article.isBookmarked ?? false);
  const [copied, setCopied] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  
  let timeAgo = "Recently";
  try {
    const date = new Date(article.publishedAt);
    if (!isNaN(date.getTime())) {
      timeAgo = formatDistanceToNow(date, { addSuffix: true });
    }
  } catch (err) {
    console.error("Invalid date for article", article.id);
  }

  // Use a unique, stable placeholder based on article ID if imageUrl is missing
  const imageUrl = article.imageUrl || `https://picsum.photos/seed/${article.id}/600/400`;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/briefing/${article.storyId}?sourceId=${article.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to share!", err);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    await fetch(`${API_URL}/api/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ article_id: article.id, liked: newLiked, saved: bookmarked, time_spent_s: 0, scroll_depth: 0 })
    });
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);
    await fetch(`${API_URL}/api/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ article_id: article.id, liked: liked, saved: newBookmarked, time_spent_s: 0, scroll_depth: 0 })
    });
  };

  return (
    <div 
      className="p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-et-border bg-white shadow-sm hover:shadow-md hover:border-et-red/20 transition-all duration-300 cursor-pointer group"
      onClick={() => onClick(article)}
    >
      <div className="flex flex-row-reverse md:flex-row gap-4 md:gap-8 items-start">
        {/* Responsive Image Container */}
        <div className="w-24 h-24 md:w-48 md:h-[160px] rounded-xl bg-et-section overflow-hidden shrink-0 border border-et-border relative group/img">
          <img 
            src={imageUrl} 
            alt={article.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-150471143881b-5110bd08f23f?auto=format&fit=crop&q=80&w=400";
            }}
          />
          <div className="absolute inset-0 bg-et-headline/5 group-hover:bg-transparent transition-colors" />
        </div>

        <div className="flex-1 min-w-0 space-y-3 md:space-y-4">
          <div className="flex flex-wrap gap-2">
            {article.topicSlugs && article.topicSlugs.length > 0 ? (
              article.topicSlugs.slice(0, 2).map((slug) => (
                <span key={slug} className="px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest bg-et-red/5 text-et-red border border-et-red/10">
                  {slug.replace("-", " ")}
                </span>
              ))
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest bg-et-red/5 text-et-red border border-et-red/10">Top News</span>
            )}
          </div>
          
          <h3 className="text-lg md:text-2xl leading-tight font-serif font-black text-et-headline group-hover:text-et-red transition-colors line-clamp-3">
            {article.title}
          </h3>

          <p className="hidden md:block text-base text-et-body line-clamp-3 leading-relaxed opacity-80 font-medium">
            {article.summary}
          </p>

          <div className="flex items-center gap-3 text-[10px] md:text-[12px] text-et-meta font-bold pt-1">
            <span className="uppercase tracking-widest">{article.source}</span>
            {article.author && (
              <>
                <span className="opacity-20">•</span>
                <span 
                  className={`italic font-medium ${article.authorId ? "hover:text-et-red hover:underline cursor-pointer" : ""}`}
                  onClick={(e) => {
                    if (article.authorId) {
                      e.stopPropagation();
                      openProfile(article.authorId);
                    }
                  }}
                >
                  By {article.author}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between pt-4 md:pt-5 border-t border-et-divider gap-4">
            <div className="flex items-center gap-4 md:gap-8">
              <button onClick={handleLike} className={`flex items-center gap-1.5 transition-all outline-none ${liked ? "text-et-red" : "text-et-meta hover:text-et-red"}`}>
                {liked ? <HeartIconSolid className="w-4 h-4 md:w-5 md:h-5" /> : <HeartIconOutline className="w-4 h-4 md:w-5 md:h-5" />}
                <span className="text-[10px] md:text-[12px] font-black uppercase tracking-widest">Like</span>
              </button>
              <button onClick={handleBookmark} className={`flex items-center gap-1.5 transition-all outline-none ${bookmarked ? "text-et-red" : "text-et-meta hover:text-et-red"}`}>
                {bookmarked ? <BookmarkIconSolid className="w-4 h-4 md:w-5 md:h-5" /> : <BookmarkIconOutline className="w-4 h-4 md:w-5 md:h-5" />}
                <span className="text-[10px] md:text-[12px] font-black uppercase tracking-widest">Save</span>
              </button>
              <button onClick={handleShare} className={`flex items-center gap-1.5 transition-all outline-none ${copied ? "text-green-600" : "text-et-meta hover:text-et-red"}`}>
                 <ShareIcon className="w-4 h-4 md:w-5 md:h-5" />
                 <span className="text-[10px] md:text-[12px] font-black uppercase tracking-widest">{copied ? "Copied" : "Share"}</span>
              </button>
            </div>
            <div className="text-[10px] md:text-[11px] text-et-meta font-black uppercase tracking-widest italic opacity-50">
              {timeAgo}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
