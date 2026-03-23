"use client";

import Link from "next/link";

export function TopNav() {
  return (
    <nav className="flex items-center justify-between py-6">
      <Link href="/" className="font-display text-2xl tracking-tight">
        The EconomicTimes
      </Link>
      <div className="flex items-center gap-4 text-sm text-slate">
      </div>
    </nav>
  );
}
