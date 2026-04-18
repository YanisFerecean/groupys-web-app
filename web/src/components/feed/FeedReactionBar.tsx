"use client";

import { PostRes } from "./FeedPostCard";

// ── Component ────────────────────────────────────────────────────────────────

interface FeedReactionBarProps {
  post: PostRes;
  onLike: () => void;
  onDislike: () => void;
  onComment: () => void;
}

export function FeedReactionBar({
  post,
  onLike,
  onDislike,
  onComment,
}: FeedReactionBarProps) {
  const { userReaction, likeCount, dislikeCount, commentCount } = post;

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-t border-surface-container-high/50">
      {/* Like button */}
      <button
        onClick={onLike}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          userReaction === "like"
            ? "bg-primary/15 text-primary"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
      >
        <span
          className="material-symbols-outlined text-base"
          style={{
            fontVariationSettings: userReaction === "like" ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          thumb_up
        </span>
        {likeCount > 0 && likeCount}
      </button>

      {/* Dislike button */}
      <button
        onClick={onDislike}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          userReaction === "dislike"
            ? "bg-error/15 text-error"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
      >
        <span
          className="material-symbols-outlined text-base"
          style={{
            fontVariationSettings: userReaction === "dislike" ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          thumb_down
        </span>
        {dislikeCount > 0 && dislikeCount}
      </button>

      {/* Comment button */}
      <button
        onClick={onComment}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors ml-auto"
      >
        <span className="material-symbols-outlined text-base">chat_bubble_outline</span>
        {commentCount > 0 ? commentCount : ""} Comment
        {commentCount !== 1 ? "s" : ""}
      </button>
    </div>
  );
}

FeedReactionBar.displayName = "FeedReactionBar";
