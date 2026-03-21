"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useChat } from "ai/react";
import { SlideOver } from "../../../components/SlideOver";
import { TopNav } from "../../../components/TopNav";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type BriefingDocument = {
  story_id: string;
  headline: string;
  generated_at: string;
  depth_tier: string;
  summary: { text: string; citations: string[] };
  sections: { id: string; title: string; content: string; citations: string[] }[];
  key_entities: { name: string; type: string; role: string }[];
  suggested_questions: string[];
  source_articles: { id: string; title: string; url: string; author: string | null; published_at: string | null }[];
};

export default function BriefingPage() {
  const params = useParams<{ story_id: string }>();
  const storyId = params.story_id;
  const [briefing, setBriefing] = useState<BriefingDocument | null>(null);
  const [activeSource, setActiveSource] = useState<BriefingDocument["source_articles"][number] | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API_URL}/api/briefing/${storyId}`, {
        credentials: "include"
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as BriefingDocument;
      setBriefing(data);
    };
    load();
  }, [storyId]);

  const { messages, input, handleInputChange, handleSubmit, setInput, isLoading } =
    useChat({
      api: `/api/briefing/${storyId}/ask`
    });

  const primarySummary = useMemo(() => {
    if (!briefing) return null;
    return briefing.summary.text;
  }, [briefing]);

  return (
    <div className="pb-32">
      <TopNav />
      {briefing ? (
        <div className="space-y-8">
          <header className="rounded-3xl border border-mist bg-white/80 p-8 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="font-display text-4xl leading-tight">
                {briefing.headline}
              </h1>
              <span className="rounded-full bg-ink px-4 py-2 text-xs uppercase tracking-[0.2em] text-paper">
                Synthesised from {briefing.source_articles.length} ET articles
              </span>
            </div>
            {primarySummary ? (
              <p className="mt-6 text-lg text-slate">{primarySummary}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {briefing.summary.citations.map((citation) => (
                <button
                  key={citation}
                  className="rounded-full border border-mist px-3 py-1 text-xs uppercase tracking-[0.2em]"
                  onClick={() => {
                    const source = briefing.source_articles.find(
                      (article) => article.id === citation
                    );
                    if (source) setActiveSource(source);
                  }}
                >
                  {citation}
                </button>
              ))}
            </div>
          </header>

          <section className="space-y-4">
            {briefing.sections.map((section) => (
              <details
                key={section.id}
                className="rounded-3xl border border-mist bg-white/80 p-6 shadow-soft"
              >
                <summary className="cursor-pointer font-display text-2xl capitalize">
                  {section.title.replace(/-/g, " ")}
                </summary>
                <p className="mt-4 text-base leading-relaxed text-ink">
                  {section.content}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {section.citations.map((citation) => (
                    <button
                      key={citation}
                      className="rounded-full border border-mist px-3 py-1 text-xs uppercase tracking-[0.2em]"
                      onClick={() => {
                        const source = briefing.source_articles.find(
                          (article) => article.id === citation
                        );
                        if (source) setActiveSource(source);
                      }}
                    >
                      {citation}
                    </button>
                  ))}
                </div>
              </details>
            ))}
          </section>

          <section className="rounded-3xl border border-mist bg-white/80 p-6 shadow-soft">
            <h2 className="font-display text-2xl">Key entities</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {briefing.key_entities.map((entity) => (
                <button
                  key={entity.name}
                  className="rounded-full border border-mist px-4 py-2 text-xs uppercase tracking-[0.2em]"
                  onClick={() =>
                    setInput(
                      `How does ${entity.name} factor into this story?`
                    )
                  }
                >
                  {entity.name}
                </button>
              ))}
            </div>
          </section>

          <details className="rounded-3xl border border-mist bg-white/80 p-6 shadow-soft">
            <summary className="cursor-pointer font-display text-2xl">
              Sources
            </summary>
            <div className="mt-4 space-y-2">
              {briefing.source_articles.map((article) => (
                <button
                  key={article.id}
                  className="block w-full rounded-2xl border border-mist px-4 py-3 text-left"
                  onClick={() => setActiveSource(article)}
                >
                  <div className="text-sm uppercase tracking-[0.2em] text-slate">
                    {article.author ?? "ET"}
                  </div>
                  <div className="font-display text-lg">{article.title}</div>
                </button>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-10 text-center text-sm uppercase tracking-[0.2em] text-slate">
          Loading briefing
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t border-mist bg-paper/95 px-6 py-4 backdrop-blur">
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about this story"
              className="flex-1 rounded-full border border-mist bg-white px-4 py-3 text-sm"
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-3 text-xs uppercase tracking-[0.2em] text-paper"
              disabled={isLoading}
            >
              Ask
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {briefing?.suggested_questions.map((q) => (
              <button
                type="button"
                key={q}
                onClick={() => setInput(q)}
                className="rounded-full border border-mist px-3 py-1 text-xs uppercase tracking-[0.2em]"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {messages.map((message) => {
              const citations = Array.from(
                new Set(
                  Array.from(
                    message.content.matchAll(/\\[source:\\s*([^\\]]+)\\]/g)
                  ).map((match) => match[1])
                )
              );
              return (
                <div
                  key={message.id}
                  className={`rounded-2xl border border-mist px-4 py-3 text-sm ${
                    message.role === "assistant"
                      ? "bg-white"
                      : "bg-ink text-paper"
                  }`}
                >
                  <div>{message.content}</div>
                  {message.role === "assistant" && citations.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {citations.map((citation) => (
                        <button
                          key={citation}
                          className="rounded-full border border-mist px-3 py-1 text-xs uppercase tracking-[0.2em]"
                          onClick={() => {
                            const source = briefing?.source_articles.find(
                              (article) => article.id === citation
                            );
                            if (source) setActiveSource(source);
                          }}
                        >
                          {citation}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </form>
      </div>

      <SlideOver
        open={Boolean(activeSource)}
        onClose={() => setActiveSource(null)}
        title={activeSource?.title ?? "Source"}
      >
        {activeSource ? (
          <iframe
            title={activeSource.title}
            src={activeSource.url}
            className="h-[70vh] w-full rounded-2xl border border-mist"
          />
        ) : null}
      </SlideOver>
    </div>
  );
}
