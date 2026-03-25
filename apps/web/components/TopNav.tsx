"use client";

import Link from "next/link";
import { LanguageSelector } from "./LanguageSelector";

export function TopNav() {
  return (
    <nav className="flex items-center justify-between py-6">
      <Link href="/" className="font-display text-2xl tracking-tight">
        The EconomicTimes
      </Link>
    </nav>
  );
}
