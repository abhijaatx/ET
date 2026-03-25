"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  HomeIcon, 
  HashtagIcon, 
  BellIcon, 
  EnvelopeIcon, 
  BookmarkIcon, 
  UserIcon,
  HeartIcon,
  VideoCameraIcon
} from "@heroicons/react/24/outline";
import { HomeIcon as HomeIconSolid, VideoCameraIcon as VideoCameraIconSolid } from "@heroicons/react/24/solid";

const navItems = [
  { name: "Home", href: "/", icon: HomeIcon, activeIcon: HomeIconSolid },
  { name: "Explore", href: "/explore", icon: HashtagIcon },
  { name: "AI Broadcast", href: "/broadcast", icon: VideoCameraIcon, activeIcon: VideoCameraIconSolid },
  { name: "Notifications", href: "/notifications", icon: BellIcon },
  { name: "Liked Posts", href: "/liked", icon: HeartIcon },
  { name: "Bookmarks", href: "/bookmarks", icon: BookmarkIcon },
  { name: "Profile", href: "/profile", icon: UserIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col py-6 px-4 bg-et-section h-full">
      <div className="space-y-4">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = (isActive && item.activeIcon) ? item.activeIcon : item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? "bg-et-red text-white shadow-md scale-[1.02]" 
                    : "text-et-body hover:bg-white hover:shadow-sm hover:text-et-red"
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? "text-white" : "text-et-secondary group-hover:text-et-red"}`} />
                <span className={`text-[15px] font-semibold ${isActive ? "font-bold" : ""}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>

  );
}
