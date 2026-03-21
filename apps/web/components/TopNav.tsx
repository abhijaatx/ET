"use client";

import Link from "next/link";

export function TopNav() {
  return (
    <nav className="flex items-center justify-between py-6">
      <Link href="/" className="font-display text-2xl tracking-tight">
        My ET
      </Link>
      <div className="flex items-center gap-4 text-sm text-slate">
        <button
          aria-label="Search"
          className="rounded-full border border-mist px-3 py-2 text-xs uppercase tracking-[0.25em]"
        >
          Search
        </button>
      </div>
    </nav>
  );
}
