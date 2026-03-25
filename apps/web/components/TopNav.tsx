"use client";

import { Bars3Icon } from "@heroicons/react/24/outline";

interface TopNavProps {
  title: string;
  onMenuClick?: () => void;
}

export function TopNav({ title, onMenuClick }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-et-divider">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onMenuClick}
            className="p-2 hover:bg-et-section rounded-full transition-colors flex items-center justify-center"
          >
            <Bars3Icon className="w-6 h-6 text-et-headline" />
          </button>
          <h1 className="text-xl font-serif font-bold text-et-headline capitalize">
            {title}
          </h1>
        </div>

        <div className="hidden md:flex items-center gap-6">
          {/* Add secondary actions here if needed */}
        </div>
      </div>
    </nav>
  );
}
