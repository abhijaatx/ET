"use client";

export default function BriefingError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h2 className="font-display text-3xl">Briefing unavailable</h2>
      <p className="mt-4 text-sm text-slate">{error.message}</p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-full border border-mist px-4 py-2 text-xs uppercase tracking-[0.2em]"
      >
        Try again
      </button>
    </div>
  );
}
