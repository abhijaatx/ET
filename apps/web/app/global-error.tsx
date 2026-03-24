"use client";

import React from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-white text-slate-900 font-sans">
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <h1 className="text-4xl font-black mb-4">Something went wrong</h1>
          <p className="text-lg text-slate-600 mb-8 max-w-md">
            The application encountered a critical error. This has been logged and we are looking into it.
          </p>
          <div className="bg-red-50 p-6 rounded-2xl border border-red-100 mb-8 text-left w-full max-w-xl overflow-auto max-h-48">
             <code className="text-sm text-red-600 whitespace-pre-wrap">{error.message}</code>
          </div>
          <button
            onClick={() => reset()}
            className="bg-red-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
          >
            Restart Application
          </button>
        </div>
      </body>
    </html>
  );
}
