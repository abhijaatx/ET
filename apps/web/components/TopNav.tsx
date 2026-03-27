"use client";

import { Bars3Icon, UserCircleIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";

interface TopNavProps {
  title: string;
  onMenuClick?: () => void;
  showLogout?: boolean;
  hideAuthInfo?: boolean;
}

export function TopNav({ title, onMenuClick, showLogout = false, hideAuthInfo = false }: TopNavProps) {
  const { user, logout, loading } = useAuth();

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

        <div className="flex items-center gap-3">
          {!loading && (
            user ? (
              !hideAuthInfo && (
                <div className="flex items-center gap-4">
                  <Link href="/profile" className="hidden md:flex flex-col items-end hover:opacity-80 transition-opacity">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-et-secondary">Authenticated</span>
                    <span className="text-xs font-serif font-bold text-et-headline">{user.name}</span>
                  </Link>
                  {showLogout ? (
                    <button
                      onClick={logout}
                      className="p-2 hover:bg-et-section rounded-full transition-colors text-et-secondary hover:text-et-red group relative"
                      title="Logout"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5" />
                      <span className="absolute -bottom-8 right-0 bg-et-headline text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Logout
                      </span>
                    </button>
                  ) : (
                    <Link 
                      href="/profile"
                      className="p-2 hover:bg-et-section rounded-full transition-colors text-et-secondary hover:text-et-headline"
                      title="View Profile"
                    >
                      <UserCircleIcon className="w-5 h-5" />
                    </Link>
                  )}
                </div>
              )
            ) : (
              <Link 
                href="/login"
                className="px-4 py-2 border border-et-border rounded-full text-[11px] font-bold uppercase tracking-widest text-et-headline hover:bg-et-headline hover:text-white transition-all"
              >
                Sign In
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
