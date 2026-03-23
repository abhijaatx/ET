"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  HomeIcon, 
  MagnifyingGlassIcon, 
  BookmarkIcon, 
  UserIcon 
} from "@heroicons/react/24/outline";
import { 
  HomeIcon as HomeIconSolid, 
  MagnifyingGlassIcon as MagnifyingGlassIconSolid, 
  BookmarkIcon as BookmarkIconSolid, 
  UserIcon as UserIconSolid 
} from "@heroicons/react/24/solid";

const navItems = [
  { name: "Home", href: "/", icon: HomeIcon, activeIcon: HomeIconSolid },
  { name: "Explore", href: "/explore", icon: MagnifyingGlassIcon, activeIcon: MagnifyingGlassIconSolid },
  { name: "Saved", href: "/liked", icon: BookmarkIcon, activeIcon: BookmarkIconSolid },
  { name: "Profile", href: "/profile", icon: UserIcon, activeIcon: UserIconSolid },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-lg border-t border-mist/50 md:hidden z-50 flex items-center justify-around px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = isActive ? item.activeIcon : item.icon;
        
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className="flex flex-col items-center justify-center gap-1 w-16 group outline-none"
          >
            <div className={`p-1.5 rounded-xl transition-all duration-300 ${
              isActive ? 'bg-red-50 text-red-600 scale-110' : 'text-slate/40 group-active:scale-90'
            }`}>
              <Icon className="w-6 h-6" />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${
              isActive ? 'text-red-600' : 'text-slate/30'
            }`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
