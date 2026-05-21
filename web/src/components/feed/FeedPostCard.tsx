"use client";

import { memo, useCallback, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import MarkdownContent from "@/components/ui/MarkdownContent";
import AuthMedia from "@/components/ui/AuthMedia";
import MediaLightbox, { LightboxItem } from "@/components/ui/MediaLightbox";
import { FeedReactionBar } from "./FeedReactionBar";
import { timeAgo, buildVisualItems, buildVisualIndexMap, getMediaSrc } from "./feed-helpers";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PostMedia {
  url: string;
  type: string;
  order: number;
}

export interface PostRes {
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
  feedReasonCode: "FRIEND_POSTED" | "FRIEND_LIKED" | "RECOMMENDED_COMMUNITY" | null;
  triggerFriendUsername: string | null;
  triggerFriendProfileImage: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

interface FeedPostCardProps {
  post: PostRes;
  onReact: (postId: string, type: "like" | "dislike") => void;
}

export const FeedPostCard = memo(function FeedPostCard({
  post,
  onReact,
}: FeedPostCardProps) {
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visualItems: LightboxItem[] = buildVisualItems(post.media);
  const visualIndexOf = buildVisualIndexMap(post.media);

  const handleLike = useCallback(() => {
    onReact(post.id, "like");
  }, [onReact, post.id]);

  const handleDislike = useCallback(() => {
    onReact(post.id, "dislike");
  }, [onReact, post.id]);

  const navigateToCommunity = useCallback(() => {
    router.push(`/discover/community/${post.communityId}`);
  }, [router, post.communityId]);

  const navigateToProfile = useCallback(() => {
    router.push(`/profile/${post.authorUsername}`);
  }, [router, post.authorUsername]);

  const navigateToPost = useCallback(() => {
    router.push(`/discover/post/${post.id}`);
  }, [router, post.id]);

  const openLightbox = useCallback((idx: number) => {
    setLightboxIndex(idx);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const hasMedia = post.media?.length > 0;
  const hasFriendReason = post.feedReasonCode === "FRIEND_LIKED" && post.triggerFriendUsername;

  return (
    <div className="relative bg-surface-container-lowest/65 border border-white/80 rounded-2xl overflow-hidden shadow-sm">
      {/* FRIEND_POSTED — author name chip */}
      {post.feedReasonCode === "FRIEND_POSTED" && (
        <div className="px-4 pt-3 pb-0">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary text-on-primary text-xs font-semibold">
            Friend
          </span>
        </div>
      )}

      {/* Community badge row */}
      <div className="flex items-center justify-between pr-4">
        <button
          onClick={navigateToCommunity}
          className="flex items-center gap-2 px-4 pt-3 pb-1 group"
        >
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
          >
            group
          </span>
          <span className="text-xs font-semibold text-primary group-hover:underline">
            {post.communityName}
          </span>
        </button>
        {post.feedReasonCode === "RECOMMENDED_COMMUNITY" && (
          <span className="text-xs text-on-surface-variant/60 pt-3 pb-1">Recommended</span>
        )}
      </div>

      {/* Author header */}
      <div
        className="flex items-center gap-3 px-4 pt-1 pb-2 cursor-pointer"
        onClick={navigateToProfile}
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
          <p className="text-sm font-semibold text-on-surface truncate hover:text-primary transition-colors">
            {post.authorDisplayName || post.authorUsername}
          </p>
          <p className="text-xs text-on-surface-variant">{timeAgo(post.createdAt)}</p>
        </div>
      </div>

      {/* Title + content (truncated) */}
      {(post.title || post.content) && (
        <div
          className="px-4 pb-3 cursor-pointer space-y-1.5"
          onClick={navigateToPost}
        >
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
      {hasMedia && (
        <FeedMediaGrid
          media={post.media}
          visualIndexOf={visualIndexOf}
          onOpenLightbox={openLightbox}
        />
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          items={visualItems}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNav={setLightboxIndex}
        />
      )}

      {/* FRIEND_LIKED — "liked by @..." row */}
      {hasFriendReason && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-surface-container-high/30">
          {post.triggerFriendProfileImage ? (
            <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
              <Image
                src={post.triggerFriendProfileImage}
                alt={post.triggerFriendUsername ?? "Friend"}
                width={20}
                height={20}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 12 }}>
                person
              </span>
            </div>
          )}
          <span className="text-xs text-on-surface-variant">
            liked by <span className="font-semibold">@{post.triggerFriendUsername}</span>
          </span>
        </div>
      )}

      {/* Reaction bar */}
      <FeedReactionBar
        post={post}
        onLike={handleLike}
        onDislike={handleDislike}
        onComment={navigateToPost}
      />
    </div>
  );
});

// ── FeedMediaGrid Sub-component ──────────────────────────────────────────────

interface FeedMediaGridProps {
  media: PostMedia[];
  visualIndexOf: number[];
  onOpenLightbox: (idx: number) => void;
}

function FeedMediaGrid({ media, visualIndexOf, onOpenLightbox }: FeedMediaGridProps) {
  const count = media.length;
  const inGrid = count > 1;

  return (
    <div className={`px-4 pb-3${inGrid ? " grid grid-cols-2 gap-1" : ""}`}>
      {media.map((m, i) => {
        const src = getMediaSrc(m.url);
        const isImage = m.type.startsWith("image/");
        const isVideo = m.type.startsWith("video/");
        const isAudio = m.type.startsWith("audio/");
        
        if (!isImage && !isVideo && !isAudio) return null;
        
        const spanFull = inGrid && (isAudio || (count === 3 && i === 0));
        const vIdx = visualIndexOf[i];
        
        const mediaClass = inGrid && !isAudio
          ? "w-full h-64 object-cover rounded-xl"
          : isImage 
            ? "max-w-full max-h-80 rounded-xl" 
            : isVideo 
              ? "max-w-full max-h-[480px] rounded-xl" 
              : undefined;

        return (
          <div key={i} className={`relative${spanFull ? " col-span-2" : ""}`}>
            {isImage ? (
              <div onClick={() => onOpenLightbox(vIdx)} className="cursor-zoom-in">
                <AuthMedia src={src} type="image" className={mediaClass} />
              </div>
            ) : isVideo ? (
              <div className="relative">
                <AuthMedia src={src} type="video" className={mediaClass} />
                <button
                  onClick={() => onOpenLightbox(vIdx)}
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
}

FeedPostCard.displayName = "FeedPostCard";
