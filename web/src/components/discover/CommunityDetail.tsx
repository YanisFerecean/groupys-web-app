"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import MarkdownContent from "@/components/ui/MarkdownContent";
import AuthMedia from "@/components/ui/AuthMedia";
import MediaLightbox, { LightboxItem } from "@/components/ui/MediaLightbox";
import { resizeImage } from "@/lib/imageResize";
import { toast } from "sonner";
import EditCommunityModal from "@/components/discover/EditCommunityModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface CommunityRes {
  id: string;
  name: string;
  description: string;
  genre: string;
  country: string;
  imageUrl: string;
  bannerUrl: string | null;
  iconType: string | null;
  iconUrl: string | null;
  tags: string[];
  artistId: number;
  memberCount: number;
  createdById: string;
  createdAt: string;
}

interface MemberRes {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  profileImage: string;
  role: string;
  joinedAt: string;
}

interface PostMedia {
  url: string;
  type: string;
  order: number;
}

interface PostRes {
  id: string;
  title: string | null;
  content: string;
  media: PostMedia[];
  communityId: string;
  communityName: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorProfileImage: string;
  createdAt: string;
  likeCount: number;
  dislikeCount: number;
  userReaction: "like" | "dislike" | null;
  commentCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 365) return `${Math.floor(days / 365)}y ago`;
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return "just now";
}

const HERO_COLORS = [
  "from-violet-600 to-purple-900",
  "from-pink-600 to-rose-900",
  "from-cyan-600 to-teal-900",
  "from-amber-600 to-orange-900",
  "from-emerald-600 to-green-900",
  "from-indigo-600 to-blue-900",
];

// ── Sub-components ───────────────────────────────────────────────────────────

function MemberRow({ member }: { member: MemberRes }) {
  const [avatarError, setAvatarError] = useState(false);
  return (
    <div className="flex items-center gap-3 py-3 px-2">
      {member.profileImage && !avatarError ? (
        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
          <Image
            src={member.profileImage}
            alt={member.displayName || member.username}
            width={40}
            height={40}
            className="object-cover w-full h-full"
            onError={() => setAvatarError(true)}
          />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-lg">
            person
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">
          {member.displayName || member.username}
        </p>
        <p className="text-xs text-on-surface-variant truncate">
          @{member.username}
        </p>
      </div>
      {member.role === "owner" && (
        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
          Owner
        </span>
      )}
      <span className="text-xs text-on-surface-variant">
        {timeAgo(member.joinedAt)}
      </span>
    </div>
  );
}


function PostCard({
  post,
  onReact,
  communityOwnerId,
  currentUserId,
  onDelete,
}: {
  post: PostRes;
  onReact: (postId: string, type: "like" | "dislike") => void;
  communityOwnerId?: string;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
}) {
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visualItems: LightboxItem[] = post.media
    ?.filter((m) => m.type.startsWith("image/") || m.type.startsWith("video/"))
    .map((m) => ({
      src: `${API_URL}${m.url.replace(/^\/api/, "")}`,
      type: m.type.startsWith("image/") ? "image" : "video",
    })) ?? [];

  let vi = -1;
  const visualIndexOf = post.media?.map((m) =>
    m.type.startsWith("image/") || m.type.startsWith("video/") ? ++vi : -1
  ) ?? [];

  const isOwner = !!communityOwnerId && communityOwnerId === post.authorId;
  const canDelete =
    !!onDelete &&
    (currentUserId === post.authorId ||
      currentUserId === communityOwnerId);

  return (
    <div
      className="bg-surface-container-lowest/65 border border-white/80 rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:border-white transition-colors"
      onClick={() => router.push(`/discover/post/${post.id}`)}
    >
      {/* Author header */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-2 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/profile/${post.authorUsername}`);
        }}
      >
        {post.authorProfileImage ? (
          <div className="w-9 h-9 shrink-0 rounded-full overflow-hidden">
            <Image
              src={post.authorProfileImage}
              alt={post.authorDisplayName || post.authorUsername}
              width={36}
              height={36}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-9 h-9 shrink-0 rounded-full bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-sm">
              person
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-on-surface truncate hover:text-primary transition-colors">
              {post.authorDisplayName || post.authorUsername}
            </p>
            {isOwner && (
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                Owner
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {canDelete && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(post.id);
            }}
            className="p-1.5 rounded-full text-on-surface-variant/50 hover:text-error hover:bg-error/10 transition-colors shrink-0"
            title="Delete post"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              delete
            </span>
          </button>
        )}
      </div>

      {/* Title + content (truncated) */}
      {(post.title || post.content) && (
        <div className="px-4 pb-3 space-y-1.5">
          {post.title && (
            <h3 className="text-[17px] font-bold leading-6 tracking-tight text-on-surface line-clamp-2">
              {post.title}
            </h3>
          )}
          {post.content && (
            <MarkdownContent
              content={post.content}
              truncate
              className={post.title ? "text-on-surface-variant/80" : "text-on-surface"}
            />
          )}
        </div>
      )}

      {/* Media */}
      {post.media?.length > 0 && (() => {
        const count = post.media.length;
        const inGrid = count > 1;
        return (
          <div className={`px-4 pb-3${inGrid ? " grid grid-cols-2 gap-1" : ""}`} onClick={(e) => e.stopPropagation()}>
            {post.media.map((m, i) => {
              const src = `${API_URL}${m.url.replace(/^\/api/, "")}`;
              const isImage = m.type.startsWith("image/");
              const isVideo = m.type.startsWith("video/");
              const isAudio = m.type.startsWith("audio/");
              if (!isImage && !isVideo && !isAudio) return null;
              const spanFull = inGrid && (isAudio || (count === 3 && i === 0));
              const vIdx = visualIndexOf[i];
              const mediaClass = inGrid && !isAudio
                ? "w-full h-64 object-cover rounded-xl"
                : isImage ? "max-w-full max-h-80 rounded-xl" : isVideo ? "max-w-full max-h-[480px] rounded-xl" : undefined;
              return (
                <div key={i} className={`relative${spanFull ? " col-span-2" : ""}`}>
                  {isImage ? (
                    <div onClick={() => setLightboxIndex(vIdx)} className="cursor-zoom-in">
                      <AuthMedia src={src} type="image" className={mediaClass} />
                    </div>
                  ) : isVideo ? (
                    <div className="relative">
                      <AuthMedia src={src} type="video" className={mediaClass} />
                      <button
                        onClick={() => setLightboxIndex(vIdx)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>fullscreen</span>
                      </button>
                    </div>
                  ) : (
                    <AuthMedia src={src} type="audio" />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {lightboxIndex !== null && (
        <MediaLightbox
          items={visualItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={setLightboxIndex}
        />
      )}

      {/* Reaction bar */}
      <div
        className="flex items-center gap-1 px-3 py-2 border-t border-surface-container-high/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onReact(post.id, "like")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            post.userReaction === "like"
              ? "bg-primary/15 text-primary"
              : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <span
            className="material-symbols-outlined text-base"
            style={{
              fontVariationSettings:
                post.userReaction === "like" ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            thumb_up
          </span>
          {post.likeCount}
        </button>

        <button
          onClick={() => onReact(post.id, "dislike")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            post.userReaction === "dislike"
              ? "bg-error/15 text-error"
              : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <span
            className="material-symbols-outlined text-base"
            style={{
              fontVariationSettings:
                post.userReaction === "dislike" ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            thumb_down
          </span>
          {post.dislikeCount}
        </button>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors ml-auto"
          onClick={(e) => { e.stopPropagation(); router.push(`/discover/post/${post.id}`); }}
        >
          <span className="material-symbols-outlined text-base">
            chat_bubble_outline
          </span>
          {post.commentCount > 0 ? post.commentCount : 0}
        </button>
      </div>
    </div>
  );
}

type SortOption = "newest" | "oldest" | "most_liked" | "most_disliked" | "most_commented";

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: "newest", label: "Newest", icon: "schedule" },
  { value: "oldest", label: "Oldest", icon: "history" },
  { value: "most_liked", label: "Most Liked", icon: "thumb_up" },
  { value: "most_disliked", label: "Most Disliked", icon: "thumb_down" },
  { value: "most_commented", label: "Most Commented", icon: "chat_bubble" },
];

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_OPTIONS.find((o) => o.value === value)!;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant bg-surface-container-high rounded-full px-3 py-1.5 hover:bg-surface-container-highest transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {current.icon}
        </span>
        {current.label}
        <span
          className={`material-symbols-outlined transition-transform ${open ? "rotate-180" : ""}`}
          style={{ fontSize: 14 }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[10rem] bg-surface-container-lowest border border-white/80 rounded-xl shadow-lg overflow-hidden py-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                opt.value === value
                  ? "text-primary bg-primary/10"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 16,
                  fontVariationSettings: opt.value === value ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Main component ───────────────────────────────────────────────────────────

export default function CommunityDetail({ id }: { id: string }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const [community, setCommunity] = useState<CommunityRes | null>(null);
  const [members, setMembers] = useState<MemberRes[]>([]);
  const [posts, setPosts] = useState<PostRes[]>([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "most_liked" | "most_disliked" | "most_commented">("newest");

  const sortedPosts = useMemo(() => {
    const sorted = [...posts];
    switch (sortOrder) {
      case "newest":
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "oldest":
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "most_liked":
        return sorted.sort((a, b) => b.likeCount - a.likeCount);
      case "most_disliked":
        return sorted.sort((a, b) => b.dislikeCount - a.dislikeCount);
      case "most_commented":
        return sorted.sort((a, b) => b.commentCount - a.commentCount);
    }
  }, [posts, sortOrder]);

  const topContributors = useMemo(() => {
    const counts = new Map<string, { authorId: string; username: string; displayName: string; profileImage: string; count: number }>();
    for (const p of posts) {
      const existing = counts.get(p.authorId);
      if (existing) {
        existing.count++;
      } else {
        counts.set(p.authorId, {
          authorId: p.authorId,
          username: p.authorUsername,
          displayName: p.authorDisplayName,
          profileImage: p.authorProfileImage,
          count: 1,
        });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [posts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [communityData, membersData, membershipData, postsData] =
          await Promise.all([
            fetch(`${API_URL}/communities/${id}`, { headers }).then((r) =>
              r.ok ? r.json() : null,
            ),
            fetch(`${API_URL}/communities/${id}/members`, { headers }).then(
              (r) => (r.ok ? r.json() : []),
            ),
            fetch(`${API_URL}/communities/${id}/membership`, {
              headers,
            }).then((r) => (r.ok ? r.json() : { member: false })),
            fetch(`${API_URL}/posts/community/${id}`, { headers }).then((r) =>
              r.ok ? r.json() : [],
            ),
          ]);
        if (!cancelled) {
          setCommunity(communityData);
          setMembers(membersData);
          setJoined(membershipData.member);
          setIsOwner(membershipData.owner ?? false);
          setPosts(postsData);
        }
      } catch (err) {
        console.error("Failed to fetch community:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, getToken]);

  // Listen for posts created via the global FAB modal
  useEffect(() => {
    const handler = (e: Event) => {
      const { post, communityId } = (e as CustomEvent).detail;
      if (communityId === id) {
        setPosts((prev) => [post, ...prev]);
      }
    };
    window.addEventListener("post-created", handler);
    return () => window.removeEventListener("post-created", handler);
  }, [id]);

  const handleBannerUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !community) return;
    setUploadingBanner(true);
    try {
      const token = await getToken();
      const resized = await resizeImage(file, 1500, 500, true);
      const formData = new FormData();
      formData.append("file", resized);
      const res = await fetch(`${API_URL}/communities/${community.id}/banner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) setCommunity(await res.json());
    } catch {
      // ignore
    } finally {
      setUploadingBanner(false);
      e.target.value = "";
    }
  }, [community, getToken]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/communities/${id}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to join (HTTP ${res.status})`);
      const updated: CommunityRes = await res.json();
      setCommunity(updated);
      setJoined(true);
      toast.success("Joined community");
      const membersRes = await fetch(`${API_URL}/communities/${id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (membersRes.ok) setMembers(await membersRes.json());
    } catch (err) {
      console.error("Join error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to join community");
    } finally {
      setJoining(false);
    }
  }, [id, getToken]);

  const handleLeave = useCallback(async () => {
    setLeaveConfirmOpen(false);
    setJoining(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/communities/${id}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to leave (HTTP ${res.status})`);
      const updated: CommunityRes = await res.json();
      setCommunity(updated);
      setJoined(false);
      toast.success("Left community");
      const membersRes = await fetch(`${API_URL}/communities/${id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (membersRes.ok) setMembers(await membersRes.json());
    } catch (err) {
      console.error("Leave error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to leave community");
    } finally {
      setJoining(false);
    }
  }, [id, getToken]);

  const handleReact = useCallback(
    async (postId: string, type: "like" | "dislike") => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/posts/${postId}/react`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type }),
        });
        if (!res.ok) throw new Error("Failed to react");
        const updated: PostRes = await res.json();
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? updated : p)),
        );
      } catch (err) {
        console.error("React error:", err);
        toast.error("Failed to react");
      }
    },
    [getToken],
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/posts/${postId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to delete post");
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success("Post deleted");
      } catch (err) {
        console.error("Delete error:", err);
        toast.error("Failed to delete post");
      }
    },
    [getToken],
  );

  const heroGradient = community
    ? HERO_COLORS[
        community.id
          .split("")
          .reduce((a, c) => a + c.charCodeAt(0), 0) % HERO_COLORS.length
      ]
    : HERO_COLORS[0];

  const visibleMembers = membersExpanded ? members : members.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-primary text-3xl">
            group
          </span>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <span className="material-symbols-outlined text-primary text-4xl">
          error_outline
        </span>
        <p className="text-on-surface font-bold text-lg">
          Community not found
        </p>
        <button
          onClick={() => router.back()}
          className="text-primary font-semibold text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  const owner = members.find((m) => m.role === "owner");
  const currentMember = clerkUser
    ? members.find((m) => m.username === clerkUser.username)
    : undefined;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div
        className={`relative h-52 sm:h-64 lg:h-72 -mx-px overflow-hidden rounded-b-3xl lg:rounded-3xl lg:mt-6 lg:mx-6 bg-gradient-to-br ${heroGradient}`}
      >
        {community.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_URL}${community.bannerUrl.replace(/^\/api/, "")}`}
            alt={community.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span
            className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 select-none pointer-events-none"
            style={{ fontSize: 200, fontVariationSettings: "'FILL' 1" }}
          >
            group
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {isOwner && (
          <>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
            />
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/60 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {uploadingBanner ? "hourglass_empty" : "add_photo_alternate"}
              </span>
              {uploadingBanner ? "Uploading…" : "Change Banner"}
            </button>
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-5 lg:px-8 pb-5">
          <button
            onClick={() => router.back()}
            className="mb-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_back
            </span>
          </button>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-white text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight drop-shadow-sm">
                {community.name}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                {community.genre && (
                  <span className="text-white/80 text-xs font-semibold bg-white/15 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
                    {community.genre}
                  </span>
                )}
                {community.country && (
                  <span className="text-white/70 text-xs font-medium">
                    {community.country}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-16">
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* Left: Posts feed */}
          <div className="flex-1 min-w-0 order-2 lg:order-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-on-surface font-bold text-base flex items-center gap-2">
                Posts
                {posts.length > 0 && (
                  <span className="text-xs font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                    {posts.length}
                  </span>
                )}
              </h3>
              {posts.length > 1 && (
                <SortDropdown value={sortOrder} onChange={setSortOrder} />
              )}
            </div>

            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-3">
                <span
                  className="material-symbols-outlined opacity-20"
                  style={{ fontSize: 48, fontVariationSettings: "'FILL' 1" }}
                >
                  article
                </span>
                <p className="text-sm font-medium">
                  {joined ? "Be the first to share something!" : "No posts yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onReact={handleReact}
                    communityOwnerId={owner?.userId}
                    currentUserId={currentMember?.userId}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 order-1 lg:order-2">
            <div className="lg:sticky lg:top-24 space-y-4">

              {/* Community info card */}
              <div className="bg-surface-container-lowest/65 border border-white/80 rounded-2xl shadow-sm overflow-hidden">
                {/* Stats row */}
                <div className="flex items-center gap-6 px-4 pt-4 pb-3">
                  <div>
                    <p className="text-primary font-extrabold text-xl leading-none">
                      {formatCount(community.memberCount)}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-0.5">members</p>
                  </div>
                  <div className="w-px h-8 bg-surface-container-highest" />
                  <div>
                    <p className="text-primary font-extrabold text-xl leading-none">
                      {posts.length}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-0.5">posts</p>
                  </div>
                  <div className="ml-auto">
                    {!isOwner && (
                      <button
                        onClick={joined ? () => setLeaveConfirmOpen(true) : handleJoin}
                        disabled={joining}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                          joined
                            ? "bg-surface-container-high text-on-surface hover:bg-error/15 hover:text-error"
                            : "bg-primary text-on-primary hover:opacity-90"
                        } disabled:opacity-50`}
                      >
                        {joining ? "…" : joined ? "Joined ✓" : "Join"}
                      </button>
                    )}
                  </div>
                </div>

                {(community.description || community.tags.length > 0 || community.artistId || owner) && (
                  <div className="h-px bg-surface-container-highest mx-4" />
                )}

                <div className="px-4 py-3 space-y-3">
                  {/* About */}
                  {community.description && (
                    <div>
                      <p className="text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                        About
                      </p>
                      <p className="text-sm text-on-surface leading-relaxed">
                        {community.description}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {community.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {community.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Artist link */}
                  {community.artistId && community.genre && (
                    <button
                      onClick={() => router.push(`/discover/artist/${community.artistId}`)}
                      className="flex items-center gap-2.5 bg-surface-container-low rounded-xl px-3 py-2.5 w-full text-left hover:bg-surface-container transition-colors"
                    >
                      <span
                        className="material-symbols-outlined text-primary shrink-0"
                        style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}
                      >
                        person
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-on-surface truncate">
                          {community.genre}
                        </p>
                        <p className="text-[0.65rem] text-on-surface-variant">View artist</p>
                      </div>
                      <span
                        className="material-symbols-outlined text-on-surface/30 shrink-0"
                        style={{ fontSize: 16 }}
                      >
                        chevron_right
                      </span>
                    </button>
                  )}

                  {/* Created by */}
                  {owner && (
                    <p className="text-xs text-on-surface-variant">
                      Created by{" "}
                      <span className="font-semibold text-on-surface">
                        {owner.displayName || owner.username}
                      </span>
                    </p>
                  )}

                  {/* Owner actions */}
                  {isOwner && (
                    <button
                      onClick={() => setEditModalOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-on-surface bg-surface-container-high hover:bg-surface-container transition-colors mt-1"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings</span>
                      Edit Community
                    </button>
                  )}
                </div>
              </div>

              {/* Members card */}
              <div className="bg-surface-container-lowest/65 border border-white/80 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
                  <h3 className="text-on-surface font-bold text-sm flex items-center gap-1.5">
                    <span
                      className="material-symbols-outlined text-on-surface-variant"
                      style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
                    >
                      group
                    </span>
                    Members
                    <span className="text-xs font-semibold text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded-full">
                      {members.length}
                    </span>
                  </h3>
                  {members.length > 5 && (
                    <button
                      onClick={() => setMembersExpanded((e) => !e)}
                      className="text-primary text-xs font-semibold hover:opacity-80 transition-opacity"
                    >
                      {membersExpanded ? "Show less" : `+${members.length - 5} more`}
                    </button>
                  )}
                </div>
                {members.length === 0 ? (
                  <p className="text-on-surface-variant text-sm px-4 pb-4">No members yet.</p>
                ) : (
                  <div className="px-2 pb-2">
                    {visibleMembers.map((m) => (
                      <MemberRow key={m.id} member={m} />
                    ))}
                  </div>
                )}
              </div>

              {/* Top contributors card */}
              {topContributors.length > 0 && (
                <div className="bg-surface-container-lowest/65 border border-white/80 rounded-2xl shadow-sm p-4">
                  <h3 className="text-on-surface font-bold text-sm mb-3 flex items-center gap-1.5">
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
                    >
                      trophy
                    </span>
                    Top Contributors
                  </h3>
                  <div className="space-y-0.5">
                    {topContributors.map((user, i) => (
                      <button
                        key={user.authorId}
                        onClick={() => router.push(`/profile/${user.username}`)}
                        className="flex items-center gap-2.5 w-full px-2 py-2 rounded-xl hover:bg-surface-container-high transition-colors text-left"
                      >
                        <span className="text-xs font-bold text-on-surface-variant w-4 text-center shrink-0">
                          {i + 1}
                        </span>
                        {user.profileImage ? (
                          <div className="w-7 h-7 shrink-0 rounded-full overflow-hidden">
                            <Image
                              src={user.profileImage}
                              alt={user.displayName || user.username}
                              width={28}
                              height={28}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 14 }}>
                              person
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-on-surface truncate">
                            {user.displayName || user.username}
                          </p>
                          <p className="text-[0.65rem] text-on-surface-variant">
                            {user.count} post{user.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </aside>
        </div>
      </div>

      {editModalOpen && (
        <EditCommunityModal
          community={community}
          onClose={() => setEditModalOpen(false)}
          onSaved={(updated) => { setCommunity(updated); setEditModalOpen(false); }}
        />
      )}

      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Leave community?</DialogTitle>
            <DialogDescription>
              You can rejoin {community?.name} at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setLeaveConfirmOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLeave}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-error text-white hover:opacity-90 transition-opacity"
            >
              Leave
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
