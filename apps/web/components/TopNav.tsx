"use client";

import Link from "next/link";
import { UserCircleIcon, Bars3Icon } from "@heroicons/react/24/outline";

export function TopNav() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-et-divider">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="text-2xl font-serif font-black tracking-tighter text-et-headline group-hover:text-et-red transition-colors">
            THE ECONOMIC<span className="text-et-red group-hover:text-et-headline"> TIMES</span>
          </div>
        </Link>

        <div className="flex items-center gap-6">
          <Link 
            href="/profile" 
            className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-et-meta hover:text-et-red transition-colors"
          >
            <UserCircleIcon className="w-5 h-5" />
            My Account
          </Link>
          <button className="md:hidden p-2 hover:bg-et-section rounded-full transition-colors">
            <Bars3Icon className="w-6 h-6 text-et-headline" />
          </button>
        </div>
      </div>
    </nav>
  );
}
