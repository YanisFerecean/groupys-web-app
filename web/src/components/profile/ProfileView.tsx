"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useProfileCustomization } from "@/hooks/useProfileCustomization";
import { useUser, useAuth } from "@clerk/nextjs";
import { fetchMyAlbumRatings } from "@/lib/api";
import Image from "next/image";
import ProfileHeader from "./ProfileHeader";
import ProfileWidgetGrid from "./ProfileWidgetGrid";
import ProfileEditDrawer from "./ProfileEditDrawer";
import MarkdownContent from "@/components/ui/MarkdownContent";
import AuthMedia from "@/components/ui/AuthMedia";
import MediaLightbox, { LightboxItem } from "@/components/ui/MediaLightbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

type Tab = "overview" | "posts" | "likes" | "communities";

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
  communityName: string;
  authorUsername: string;
  authorDisplayName: string;
  authorProfileImage: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

interface CommunityRes {
  id: string;
  name: string;
  genre: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  tags: string[];
  joinedAt: string;
  postCount: number;
  role: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function memberSince(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function PostCard({ post, onClickPost }: { post: PostRes; onClickPost: (id: string) => void }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visualItems: LightboxItem[] = (post.media ?? [])
    .filter((m) => m.type.startsWith("image/") || m.type.startsWith("video/"))
    .map((m) => ({
      src: `${API_URL}${m.url.replace(/^\/api/, "")}`,
      type: m.type.startsWith("image/") ? "image" : "video",
    }));

  let vi = -1;
  const visualIndexOf = (post.media ?? []).map((m) =>
    m.type.startsWith("image/") || m.type.startsWith("video/") ? ++vi : -1
  );

  const mediaItems = post.media ?? [];
  const count = mediaItems.length;
  const inGrid = count > 1;

  return (
    <div
      key={post.id}
      onClick={() => onClickPost(post.id)}
      className="bg-surface-container-lowest/65 border border-white/80 rounded-2xl overflow-hidden cursor-pointer hover:border-white transition-colors"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        {post.authorProfileImage ? (
          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
            <Image src={post.authorProfileImage} alt={post.authorDisplayName || post.authorUsername} width={28} height={28} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-surface-container-high shrink-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-xs text-on-surface-variant/40">person</span>
          </div>
        )}
        <span className="text-xs text-on-surface-variant">{timeAgo(post.createdAt)}</span>
        <span className="text-xs text-on-surface-variant/50 ml-auto">{post.communityName}</span>
      </div>

      {/* Title + content */}
      {(post.title || post.content) && (
        <div className="px-4 pb-2 space-y-1">
          {post.title && (
            <h3 className="text-sm font-bold leading-snug tracking-tight text-on-surface line-clamp-2">
              {post.title}
            </h3>
          )}
          {post.content && (
            <MarkdownContent
              content={post.content}
              truncate
              className={`text-sm ${post.title ? "text-on-surface-variant/80" : "text-on-surface"}`}
            />
          )}
        </div>
      )}

      {/* Media */}
      {count > 0 && (
        <div
          className={`px-4 pb-3${inGrid ? " grid grid-cols-2 gap-1" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          {mediaItems.map((m, i) => {
            const src = `${API_URL}${m.url.replace(/^\/api/, "")}`;
            const isImage = m.type.startsWith("image/");
            const isVideo = m.type.startsWith("video/");
            const isAudio = m.type.startsWith("audio/");
            if (!isImage && !isVideo && !isAudio) return null;
            const spanFull = inGrid && (isAudio || (count === 3 && i === 0));
            const vIdx = visualIndexOf[i];
            const mediaClass = inGrid && !isAudio
              ? "w-full h-56 object-cover rounded-xl"
              : isImage ? "max-w-full max-h-72 rounded-xl" : isVideo ? "max-w-full max-h-[400px] rounded-xl" : undefined;
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
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          items={visualItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={setLightboxIndex}
        />
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-surface-container-high/50 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">thumb_up</span>
          {post.likeCount}
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">chat_bubble_outline</span>
          {post.commentCount}
        </span>
      </div>
    </div>
  );
}

function PostList({ posts, loading, onClickPost }: {
  posts: PostRes[];
  loading: boolean;
  onClickPost: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 rounded-full bg-surface-container-high animate-pulse" />
      </div>
    );
  }
  if (!posts.length) {
    return (
      <div className="flex flex-col items-center py-16 gap-2 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl">article</span>
        <p className="text-sm font-medium">No posts yet</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onClickPost={onClickPost} />
      ))}
    </div>
  );
}

const CARD_COLORS = [
  "from-violet-500 to-purple-700",
  "from-pink-500 to-rose-700",
  "from-cyan-500 to-teal-700",
  "from-amber-500 to-orange-700",
  "from-emerald-500 to-green-700",
  "from-indigo-500 to-blue-700",
];

function cardColorFromId(id: string) {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return CARD_COLORS[hash % CARD_COLORS.length];
}

function CommunityList({ communities, loading, onClickCommunity, onLeaveCommunity }: {
  communities: CommunityRes[];
  loading: boolean;
  onClickCommunity: (id: string) => void;
  onLeaveCommunity: (id: string) => Promise<void>;
}) {
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const confirmCommunity = communities.find((c) => c.id === confirmId);

  async function handleLeave() {
    if (!confirmId) return;
    setLeavingId(confirmId);
    setConfirmId(null);
    try {
      await onLeaveCommunity(confirmId);
    } finally {
      setLeavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[16/9] rounded-2xl bg-surface-container-high animate-pulse" />
        ))}
      </div>
    );
  }
  if (!communities.length) {
    return (
      <div className="flex flex-col items-center py-16 gap-2 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl">group</span>
        <p className="text-sm font-medium">No communities yet</p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {communities.map((c) => {
          const imgSrc = (c.bannerUrl || c.imageUrl)
            ? `${API_URL}${(c.bannerUrl ?? c.imageUrl)!.replace(/^\/api/, "")}`
            : null;
          const isLeaving = leavingId === c.id;
          const canLeave = c.role !== "owner";
          return (
            <div
              key={c.id}
              onClick={() => !isLeaving && onClickCommunity(c.id)}
              className="group relative aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:scale-[1.02] transition-transform"
            >
              {imgSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgSrc} alt={c.name} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${cardColorFromId(c.id)}`}>
                  <span
                    className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/10 select-none"
                    style={{ fontSize: 80, fontVariationSettings: "'FILL' 1" }}
                  >
                    group
                  </span>
                </div>
              )}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.88) 100%)" }}
              />
              {canLeave && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmId(c.id); }}
                  disabled={isLeaving}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-error/80 text-white rounded-full p-1.5 disabled:opacity-50"
                  title="Leave community"
                >
                  {isLeaving ? (
                    <span className="material-symbols-outlined text-sm" style={{ fontSize: 16 }}>hourglass_empty</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm" style={{ fontSize: 16 }}>logout</span>
                  )}
                </button>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {c.tags?.slice(0, 2).map((tag) => (
                    <span key={tag} className="bg-white/25 text-white px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">
                      {tag}
                    </span>
                  ))}
                  {c.genre && !c.tags?.length && (
                    <span className="bg-white/25 text-white px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">
                      {c.genre}
                    </span>
                  )}
                </div>
                <h3 className="text-white font-extrabold text-base leading-tight">{c.name}</h3>
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-xs leading-tight">{c.memberCount}</span>
                    <span className="text-white/60 text-[9px] uppercase tracking-widest font-semibold">Members</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-xs leading-tight">{c.postCount}</span>
                    <span className="text-white/60 text-[9px] uppercase tracking-widest font-semibold">My Posts</span>
                  </div>
                  {c.joinedAt && (
                    <div className="flex flex-col">
                      <span className="text-white font-bold text-xs leading-tight">{memberSince(c.joinedAt)}</span>
                      <span className="text-white/60 text-[9px] uppercase tracking-widest font-semibold">Joined</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!confirmId} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Leave community?</DialogTitle>
            <DialogDescription>
              You can rejoin {confirmCommunity?.name} at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setConfirmId(null)}
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
    </>
  );
}

function useMusicCallback() {
  const searchParams = useSearchParams();
  const musicParam = searchParams.get("music");
  return musicParam === "connected"
    ? "connected"
    : musicParam === "error"
      ? "error"
      : null;
}

export default function ProfileView() {
  const {
    profile,
    updateProfile,
    updateUsername,
    updateProfileImage,
    removeProfileImage,
    isLoaded,
    isSaving,
    musicConnected,
    setMusicConnected,
    lastFmConnected,
    lastFmUsername,
  } = useProfileCustomization();
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const musicCallback = useMusicCallback();
  const [albumsRatedCount, setAlbumsRatedCount] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab) ?? "overview";

  // Tab data
  const [posts, setPosts] = useState<PostRes[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [likes, setLikes] = useState<PostRes[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [communities, setCommunities] = useState<CommunityRes[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getTokenRef.current();
        const ratings = await fetchMyAlbumRatings(token);
        setAlbumsRatedCount(ratings.length);
      } catch {
        // silently fail
      }
    })();
  }, []);

  const fetchPosts = useCallback(async () => {
    if (posts.length) return;
    setPostsLoading(true);
    try {
      const token = await getTokenRef.current();
      const res = await fetch(`${API_URL}/posts/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPosts(await res.json());
    } catch { /* silent */ } finally {
      setPostsLoading(false);
    }
  }, [posts.length]);

  const fetchLikes = useCallback(async () => {
    if (likes.length) return;
    setLikesLoading(true);
    try {
      const token = await getTokenRef.current();
      const res = await fetch(`${API_URL}/posts/liked`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setLikes(await res.json());
    } catch { /* silent */ } finally {
      setLikesLoading(false);
    }
  }, [likes.length]);

  const fetchCommunities = useCallback(async () => {
    if (communities.length) return;
    setCommunitiesLoading(true);
    try {
      const token = await getTokenRef.current();
      const res = await fetch(`${API_URL}/communities/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCommunities(await res.json());
    } catch { /* silent */ } finally {
      setCommunitiesLoading(false);
    }
  }, [communities.length]);

  const handleLeaveCommunity = useCallback(async (communityId: string) => {
    try {
      const token = await getTokenRef.current();
      const res = await fetch(`${API_URL}/communities/${communityId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to leave");
      setCommunities((prev) => prev.filter((c) => c.id !== communityId));
      toast.success("Left community");
    } catch {
      toast.error("Failed to leave community");
      throw new Error("leave failed");
    }
  }, []);

  useEffect(() => {
    if (activeTab === "posts") fetchPosts();
    if (activeTab === "likes") fetchLikes();
    if (activeTab === "communities") fetchCommunities();
  }, [activeTab, fetchPosts, fetchLikes, fetchCommunities]);

  // Open the editor drawer when arriving from Spotify OAuth callback
  const [isEditing, setIsEditing] = useState(musicCallback === "connected");

  // Mark spotify as connected & clean up URL param
  useEffect(() => {
    if (!musicCallback) return;
    if (musicCallback === "connected") {
      setMusicConnected(true);
    }
    router.replace("/profile", { scroll: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !isLoaded) return null;

  const clerkName = user.fullName ?? user.username ?? "Music Fan";
  const memberYear = new Date(user.createdAt!).getFullYear();

  return (
    <div
      style={
        profile.accentColor
          ? ({ "--profile-accent": profile.accentColor } as React.CSSProperties)
          : undefined
      }
    >
      <ProfileHeader
        profile={profile}
        avatarUrl={user.imageUrl}
        clerkName={clerkName}
        username={user.username ?? ""}
        albumsRatedCount={albumsRatedCount}
        onEditClick={() => setIsEditing(true)}
      />

      {activeTab === "overview" && (
        <ProfileWidgetGrid
          profile={profile}
          username={user.username ?? ""}
          musicConnected={musicConnected}
          isEditing={true}
          onReorder={(newOrder) => updateProfile({ ...profile, widgetOrder: newOrder })}
          onSettingsChange={(type, color, size) => {
            const colorKey =
              type === "topAlbums" ? "albumsContainerColor" :
              type === "topSongs" ? "songsContainerColor" :
              type === "topArtists" ? "artistsContainerColor" :
              type === "lastRatedAlbum" ? "lastRatedAlbumContainerColor" :
              type === "currentlyListening" ? "currentlyListeningContainerColor" :
              type === "hotTake" ? "hotTakeContainerColor" : null;
            const updates = { ...profile, widgetSizes: { ...(profile.widgetSizes ?? {}), [type]: size } };
            if (colorKey) (updates as Record<string, unknown>)[colorKey] = color;
            updateProfile(updates);
          }}
        />
      )}
      {(activeTab === "posts" || activeTab === "likes") && (
        <div className="px-4 py-8 max-w-2xl mx-auto">
          {activeTab === "posts" && (
            <PostList
              posts={posts}
              loading={postsLoading}
              onClickPost={(id) => router.push(`/discover/post/${id}`)}
            />
          )}
          {activeTab === "likes" && (
            <PostList
              posts={likes}
              loading={likesLoading}
              onClickPost={(id) => router.push(`/discover/post/${id}`)}
            />
          )}
        </div>
      )}
      {activeTab === "communities" && (
        <div className="px-4 py-8">
          {activeTab === "communities" && (
            <CommunityList
              communities={communities}
              loading={communitiesLoading}
              onClickCommunity={(id) => router.push(`/discover/community/${id}`)}
              onLeaveCommunity={handleLeaveCommunity}
            />
          )}
        </div>
      )}

      <div className="px-6 md:px-12 pb-6 text-center">
        <p className="text-xs text-on-surface-variant/50 font-medium">Member since {memberYear}</p>
      </div>

      <ProfileEditDrawer
        open={isEditing}
        onOpenChange={setIsEditing}
        profile={profile}
        currentUsername={user.username ?? ""}
        currentAvatarUrl={user.imageUrl}
        onSave={updateProfile}
        onUpdateUsername={updateUsername}
        onUpdateProfileImage={updateProfileImage}
        onRemoveProfileImage={removeProfileImage}
        isSaving={isSaving}
        musicConnected={musicConnected}
        lastFmConnected={lastFmConnected}
        lastFmUsername={lastFmUsername}
        initialTab={musicCallback === "connected" ? "widgets" : "profile"}
      />
    </div>
  );
}
