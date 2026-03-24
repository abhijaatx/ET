import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">404: LOST IN THE FEED</h2>
      <p className="text-slate-500 mb-8 max-w-sm">
        We couldn't find the briefing you were looking for. It may have been archived or moved.
      </p>
      <Link 
        href="/" 
        className="px-8 py-3 bg-red-600 text-white rounded-full font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
      >
        GO BACK HOME
      </Link>
    </div>
  );
}
