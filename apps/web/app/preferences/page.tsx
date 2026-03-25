"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ChevronLeftIcon, 
  TrashIcon, 
  PlusIcon,
  TagIcon,
  AcademicCapIcon,
  GlobeAltIcon,
  LightBulbIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline";
import { TopNav } from "../../components/TopNav";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Interest {
  topicSlug: string;
  weight: number;
}

interface Entity {
  entityName: string;
  affinityScore: number;
}

export default function PreferencesPage() {
  const [topics, setTopics] = useState<Interest[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/interests`, { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        setTopics(data.topics || []);
        setEntities(data.entities || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteTopic = async (slug: string) => {
    try {
      const res = await fetch(`${API_URL}/api/interests/topic/${slug}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        setTopics(topics.filter(t => t.topicSlug !== slug));
      }
    } catch (err) {
      console.error("Failed to delete topic", err);
    }
  };

  const handleDeleteEntity = async (name: string) => {
    try {
      const res = await fetch(`${API_URL}/api/interests/entity/${name}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        setEntities(entities.filter(e => e.entityName !== name));
      }
    } catch (err) {
      console.error("Failed to delete entity", err);
    }
  };

  const handleAddTopic = async () => {
    const slug = prompt("Enter topic name (e.g. business, technology, sports):");
    if (!slug) return;

    try {
      const res = await fetch(`${API_URL}/api/interests/topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topicSlug: slug.toLowerCase(), weight: 0.5 })
      });
      if (res.ok) {
        // Refresh full list to be safe
        const dataRes = await fetch(`${API_URL}/api/interests`, { credentials: "include" });
        const data = await dataRes.json();
        setTopics(data.topics || []);
      }
    } catch (err) {
      console.error("Failed to add topic", err);
    }
  };

  const handleRecalibrate = async () => {
    try {
      // Trigger a session-wide interest update (mocked as a POST to signals/recalibrate)
      alert("Recalibrating your interest graph based on recent activity...");
      // For now, we just refresh the data
      const res = await fetch(`${API_URL}/api/interests`, { credentials: "include" });
      const data = await res.json();
      setTopics(data.topics || []);
      setEntities(data.entities || []);
    } catch (err) {
      console.error("Failed to recalibrate", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-et-section flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-et-red/20 border-t-et-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-et-section pb-20">
      <TopNav />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/profile" className="inline-flex items-center text-et-red font-bold text-xs uppercase tracking-widest mb-8 hover:translate-x-[-4px] transition-transform">
          <ChevronLeftIcon className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>

        <header className="mb-12">
          <h1 className="text-4xl font-serif font-bold text-et-headline mb-4">Reading Preferences</h1>
          <p className="text-et-secondary text-lg">Personalize your AI news feed by managing your topic interests and entity affinities.</p>
        </header>

        <div className="space-y-12">
          {/* Topics Section */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-serif font-bold text-et-headline">Topics of Interest</h2>
                <p className="text-xs text-et-meta uppercase tracking-wider mt-1">Weighted based on your activity</p>
              </div>
              <button 
                onClick={handleAddTopic}
                className="p-2 bg-et-red text-white rounded-full hover:bg-[#B01722] transition-colors shadow-lg"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topics.map((topic, i) => (
                <motion.div 
                  key={topic.topicSlug}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-red-100 flex justify-between items-center group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-et-red rounded-xl">
                      <TagIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-et-headline capitalize">{topic.topicSlug}</div>
                      <div className="text-[10px] font-bold text-et-meta uppercase tracking-widest">Weight: {Math.round(topic.weight * 100)}%</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteTopic(topic.topicSlug)}
                    className="p-2 text-et-meta hover:text-et-red transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
              {topics.length === 0 && (
                <div className="col-span-2 py-12 text-center bg-white/50 rounded-3xl border-2 border-dashed border-red-100 text-et-secondary italic">
                  No explicit topic interests found. Keep reading to build your profile!
                </div>
              )}
            </div>
          </section>

          {/* Entities Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-serif font-bold text-et-headline">Entity Affinity</h2>
              <p className="text-xs text-et-meta uppercase tracking-wider mt-1">Specific companies, people, and regions you follow</p>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-indigo-100 overflow-hidden">
               {entities.length > 0 ? (
                 <div className="divide-y divide-gray-50">
                   {entities.map((entity, i) => (
                      <motion.div 
                        key={entity.entityName}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        className="p-5 flex justify-between items-center hover:bg-et-section/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ChartBarIcon className="w-5 h-5 text-indigo-400" />
                          <span className="font-bold text-et-headline text-sm">{entity.entityName}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteEntity(entity.entityName)}
                          className="p-2 text-et-meta hover:text-et-red opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-4">
                          <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full" 
                              style={{ width: `${entity.affinityScore * 10}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-et-meta">{entity.affinityScore}/10</span>
                        </div>
                      </motion.div>
                   ))}
                 </div>
               ) : (
                 <div className="p-12 text-center text-et-secondary italic text-sm">
                   No specific entity data yet.
                 </div>
               )}
            </div>
          </section>

          {/* Feed Customization Card */}
          <section className="bg-[#1A2B3C] rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl border border-white/10">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-serif font-bold mb-3 text-white">Refine your AI Briefing</h3>
                <p className="text-sm text-gray-300 font-medium max-w-md">The Navigator uses these signals to curate your daily digest. Recalibrate to refresh your personalized experience.</p>
              </div>
              <button 
                onClick={handleRecalibrate}
                className="px-8 py-3 bg-[#E5C100] text-[#1A2B3C] rounded-xl font-bold text-sm shadow-xl shadow-[#E5C100]/20 hover:scale-105 transition-transform whitespace-nowrap"
              >
                Recalibrate Feed
              </button>
            </div>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-et-red/20 rounded-full blur-3xl opacity-50" />
          </section>
        </div>
      </div>
    </div>
  );
}
