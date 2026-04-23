"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { fetchCurrentHotTake, fetchMyHotTakeAnswer, type HotTakeRes } from "@/lib/hot-take-api";
import HotTakeAnswerModal from "./HotTakeAnswerModal";
import { useHotTakeStore } from "@/store/hotTakeStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

interface CommunityRes {
  id: string;
  name: string;
  genre: string | null;
  country: string | null;
  memberCount: number;
  tags: string[];
  iconUrl: string | null;
  iconType: string | null;
}

function resolveIconUrl(iconUrl: string | null | undefined): string | null {
  if (!iconUrl) return null;
  if (iconUrl.startsWith("http")) return iconUrl;
  return `${API_URL}${iconUrl.replace(/^\/api/, "")}`;
}

const COLORS = [
  "from-violet-500 to-purple-700",
  "from-pink-500 to-rose-700",
  "from-cyan-500 to-teal-700",
  "from-amber-500 to-orange-700",
  "from-emerald-500 to-green-700",
  "from-indigo-500 to-blue-700",
];

function colorFromId(id: string) {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

export default function FeedSidebar() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [communities, setCommunities] = useState<CommunityRes[]>([]);
  const [trending, setTrending] = useState<CommunityRes[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Hot take notification state
  const [hotTake, setHotTake] = useState<HotTakeRes | null>(null);
  const [answered, setAnswered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const setHasUnanswered = useHotTakeStore((s) => s.setHasUnanswered);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const [mineRes, trendingRes, ht, answer] = await Promise.all([
          fetch(`${API_URL}/communities/mine`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/communities/trending?limit=5`, { headers: { Authorization: `Bearer ${token}` } }),
          fetchCurrentHotTake(),
          fetchMyHotTakeAnswer(token),
        ]);
        if (mineRes.ok && !cancelled) setCommunities(await mineRes.json());
        if (trendingRes.ok && !cancelled) setTrending(await trendingRes.json());
        if (!cancelled) {
          setHotTake(ht);
          setAnswered(!!answer);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  // Refresh answered state when user submits from modal or HotTakeCard
  useEffect(() => {
    const handler = async () => {
      const token = await getToken();
      const answer = await fetchMyHotTakeAnswer(token);
      setAnswered(!!answer);
    };
    window.addEventListener("hot-take-answered", handler);
    return () => window.removeEventListener("hot-take-answered", handler);
  }, [getToken]);

  const visible = expanded ? communities : communities.slice(0, 3);
  const showHotTakeNotification = !!hotTake && !answered;

  useEffect(() => {
    setHasUnanswered(showHotTakeNotification);
  }, [showHotTakeNotification, setHasUnanswered]);

  return (
    <aside className="hidden xl:flex w-80 h-[calc(100vh-5rem)] sticky top-20 border-l border-surface-container-highest px-8 py-12 flex-col gap-12 overflow-y-auto ml-auto">

      {/* Hot Take notification */}
      {showHotTakeNotification && (
        <div className="rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/10 via-surface-container-low to-surface-container-low p-4">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
            >
              local_fire_department
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Hot Take{hotTake.weekLabel ? ` · ${hotTake.weekLabel}` : ""}
            </span>
          </div>
          <p className="text-sm font-semibold text-on-surface line-clamp-2 mb-3">
            {hotTake.question}
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="w-full py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity"
          >
            Answer now →
          </button>
        </div>
      )}

      {/* Trending */}
      <div>
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60 mb-6">
          Trending Now
        </h4>
        {trending.length === 0 ? (
          <p className="text-xs text-on-surface-variant/50">No trending communities this week.</p>
        ) : (
          <div className="space-y-6">
            {trending.map((c, i) => {
              const iconSrc = resolveIconUrl(c.iconUrl);
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/discover/community/${c.id}`)}
                  className="flex items-center gap-3 group w-full text-left"
                >
                  <span className="text-2xl font-black text-surface-container-highest group-hover:text-primary transition-colors shrink-0 w-8 text-center">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className={`w-9 h-9 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br ${colorFromId(c.id)} flex items-center justify-center`}>
                    {iconSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconSrc} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-white" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>group</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-none mb-1 truncate group-hover:text-primary transition-colors">
                      {c.name}
                    </p>
                    <p className="text-xs text-on-surface-variant/60 truncate">
                      {[c.genre, c.country].filter(Boolean).join(" · ") || `${c.memberCount} members`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Your Communities */}
      <div>
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60 mb-6">
          Your Communities
        </h4>
        {communities.length === 0 ? (
          <p className="text-xs text-on-surface-variant/50">
            You haven&apos;t joined any communities yet.
          </p>
        ) : (
          <>
            <div className="space-y-4">
              {visible.map((c) => {
                const iconSrc = resolveIconUrl(c.iconUrl);
                return (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/discover/community/${c.id}`)}
                    className="flex items-center gap-3 w-full text-left group"
                  >
                    <div className={`w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br ${colorFromId(c.id)} flex items-center justify-center`}>
                      {iconSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iconSrc} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>group</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-none mb-1 truncate group-hover:text-primary transition-colors">
                        {c.name}
                      </p>
                      <p className="text-xs text-on-surface-variant/60">
                        {c.memberCount} member{c.memberCount !== 1 ? "s" : ""}
                        {c.country ? ` · ${c.country}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {communities.length > 3 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="mt-4 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
              >
                {expanded
                  ? "Show less"
                  : `Show all ${communities.length} communities`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Hot Take answer modal */}
      {hotTake && (
        <HotTakeAnswerModal
          open={modalOpen}
          hotTake={hotTake}
          onClose={() => setModalOpen(false)}
          onAnswered={() => { setModalOpen(false); setAnswered(true); }}
        />
      )}
    </aside>
  );
}
