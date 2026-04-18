"use client";

import { LightboxItem } from "@/components/ui/MediaLightbox";
import { PostMedia } from "./FeedPostCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

/**
 * Formats a date string into a relative time ago string
 * (e.g., "2h ago", "3d ago", "1mo ago")
 */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 365) return `${Math.floor(days / 365)}y ago`;
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return "just now";
}

/**
 * Builds lightbox items from post media
 * Filters for visual media (images/videos) only
 */
export function buildVisualItems(media: PostMedia[]): LightboxItem[] {
  return media
    ?.filter((m) => m.type.startsWith("image/") || m.type.startsWith("video/"))
    .map((m) => ({
      src: getMediaSrc(m.url),
      type: m.type.startsWith("image/") ? "image" : "video",
    })) ?? [];
}

/**
 * Maps original media index to visual media index
 * Returns -1 for non-visual media (audio, etc.)
 */
export function buildVisualIndexMap(media: PostMedia[]): number[] {
  let vi = -1;
  return media?.map((m) =>
    m.type.startsWith("image/") || m.type.startsWith("video/") ? ++vi : -1
  ) ?? [];
}

/**
 * Converts a media URL to a full API URL
 */
export function getMediaSrc(url: string): string {
  return `${API_URL}${url.replace(/^\/api/, "")}`;
}
