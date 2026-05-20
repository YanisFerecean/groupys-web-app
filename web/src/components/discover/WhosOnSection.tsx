"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import SectionHeader from "@/components/discover/SectionHeader";
import { fetchSuggestedUsers } from "@/lib/match-api";
import { followUser } from "@/lib/discovery-api";
import type { SuggestedUser } from "@/types/match";

// ── Reason code → human-readable label + icon ──────────────────────────────

const REASON_MAP: Record<string, { label: string; icon: string }> = {
  SHARED_TOP_ARTISTS: { label: "Shared artists", icon: "library_music" },
  SHARED_GENRES: { label: "Same taste", icon: "tune" },
  SIMILAR_COMMUNITY_MEMBERS: { label: "Same community", icon: "groups" },
  SHARED_COMMUNITIES: { label: "Same community", icon: "groups" },
  SAME_COUNTRY: { label: "Same country", icon: "location_on" },
  FOLLOW_GRAPH_PROXIMITY: { label: "Mutual follows", icon: "group" },
  FRIENDS_OF_FRIENDS: { label: "Mutual friends", icon: "people" },
};

function topReason(reasonCodes: string[]): { label: string; icon: string } | null {
  for (const code of reasonCodes) {
    const entry = REASON_MAP[code];
    if (entry) return entry;
  }
  return null;
}

// ── Card ───────────────────────────────────────────────────────────────────

function UserOnlineCard({
  user,
  token,
}: {
  user: SuggestedUser;
  token: string | null;
}) {
  const router = useRouter();
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(false);

  const name = user.displayName ?? user.username;
  const reason = topReason(user.reasonCodes);

  async function handleFollow(e: React.MouseEvent) {
    e.stopPropagation();
    if (followed || loading) return;
    setLoading(true);
    try {
      await followUser(user.userId, token);
      setFollowed(true);
    } catch {
      // silent — user can retry from profile page
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-outline-variant/30 bg-primary/5 w-36 shrink-0">
      {/* Avatar + name → navigate to profile */}
      <button
        onClick={() => router.push(`/discover/user/${user.username}`)}
        className="flex flex-col items-center gap-2 w-full hover:opacity-80 transition-opacity"
      >
        {user.profileImage ? (
          <div className="w-16 h-16 rounded-full overflow-hidden shrink-0">
            <Image
              src={user.profileImage}
              alt={name}
              width={64}
              height={64}
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center">
            <span
              className="material-symbols-outlined text-on-surface-variant"
              style={{ fontSize: 28 }}
            >
              person
            </span>
          </div>
        )}
        <p className="text-sm font-extrabold text-on-surface tracking-tight truncate w-full text-center">
          {name}
        </p>
      </button>

      {/* Why this user */}
      {reason ? (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10">
          <span
            className="material-symbols-outlined text-secondary"
            style={{ fontSize: 11 }}
          >
            {reason.icon}
          </span>
          <span className="text-[10px] font-semibold text-secondary truncate">
            {reason.label}
          </span>
        </div>
      ) : (
        <div className="h-5" />
      )}

      {/* Follow button */}
      <button
        onClick={handleFollow}
        disabled={followed || loading}
        className={`w-full text-xs font-bold py-1.5 rounded-xl transition-colors ${
          followed
            ? "bg-surface-container-high text-on-surface-variant cursor-default"
            : "bg-primary text-on-primary hover:bg-primary/90 active:scale-95"
        }`}
      >
        {loading ? "..." : followed ? "Following" : "Follow"}
      </button>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function UserOnlineSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-outline-variant/30 w-36 shrink-0 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-surface-container-highest" />
      <div className="w-20 h-3.5 rounded bg-surface-container-highest" />
      <div className="w-24 h-5 rounded-full bg-surface-container-high" />
      <div className="w-full h-7 rounded-xl bg-surface-container-high" />
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────

export default function WhosOnSection() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await getToken();
        const data = await fetchSuggestedUsers(t, 6, false);
        if (!cancelled) {
          setToken(t);
          setUsers(data);
        }
      } catch (err) {
        console.error("Failed to fetch suggested users:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  if (!loading && users.length === 0) return null;

  return (
    <section className="mb-12 lg:mb-16">
      <SectionHeader title="Who's On?" actionText="See All" />
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <UserOnlineSkeleton key={i} />
            ))
          : users.map((user) => (
              <UserOnlineCard key={user.userId} user={user} token={token} />
            ))}
      </div>
    </section>
  );
}
