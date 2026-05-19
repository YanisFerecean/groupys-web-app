"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { fetchUserAlbumRatings, type AlbumRatingRes } from "@/lib/api";
import { getContrastColor } from "@/lib/utils";
import WidgetCard from "./WidgetCard";


export default function LastRatedAlbumWidget({ username, containerColor, size = "normal" }: { username: string; containerColor?: string; size?: "small" | "normal" }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [ratings, setRatings] = useState<AlbumRatingRes[]>([]);
  const [loading, setLoading] = useState(true);
  const textColor = containerColor ? getContrastColor(containerColor) : undefined;

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const data = await fetchUserAlbumRatings(username, token);
        setRatings(data.slice(0, size === "small" ? 1 : 3));
      } catch {
        // silently fail — widget just won't show
      } finally {
        setLoading(false);
      }
    })();
  }, [username, getToken, size]);

  const coverSize = 48;

  return (
    <WidgetCard
      title={size === "small" ? "Last Rated Album" : "Last Rated Albums"}
      className="h-[260px] flex flex-col overflow-hidden"
      style={containerColor ? { backgroundColor: containerColor } : undefined}
      textColor={textColor}
    >
      {loading ? (
        <div className="h-16 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-outline border-t-primary animate-spin" />
        </div>
      ) : ratings.length > 0 ? (
        size === "small" ? (
          <button
            className="w-full text-left flex flex-col gap-3 group"
            onClick={() => router.push(`/discover/album/${ratings[0].albumId}`)}
          >
            {ratings[0].albumCoverUrl ? (
              <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-md">
                <Image
                  src={ratings[0].albumCoverUrl}
                  alt={ratings[0].albumTitle}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            ) : (
              <div className="w-full aspect-square rounded-xl bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl">album</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: textColor ?? "inherit" }}>
                {ratings[0].albumTitle}
              </p>
              <p className="text-xs font-bold mt-0.5 flex items-baseline gap-1.5 min-w-0">
                <span style={{ color: textColor ?? "var(--profile-accent, var(--color-primary))", flexShrink: 0 }}>
                  {ratings[0].score}/10
                </span>
                {ratings[0].review && (
                  <span
                    className="truncate font-normal"
                    style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}
                  >
                    · {ratings[0].review}
                  </span>
                )}
              </p>
            </div>
          </button>
        ) : (
          <div className="space-y-3">
            {ratings.map((rating) => (
              <button
                key={rating.albumId}
                className="w-full text-left flex items-center gap-3 group"
                onClick={() => router.push(`/discover/album/${rating.albumId}`)}
              >
                {rating.albumCoverUrl ? (
                  <Image
                    src={rating.albumCoverUrl}
                    alt={rating.albumTitle}
                    width={coverSize}
                    height={coverSize}
                    className="rounded-lg object-cover shrink-0 shadow group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div
                    className="rounded-lg bg-surface-container-high flex items-center justify-center shrink-0"
                    style={{ width: coverSize, height: coverSize }}
                  >
                    <span className="material-symbols-outlined text-on-surface-variant/40 text-2xl">album</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: textColor ?? "inherit" }}>
                    {rating.albumTitle}
                  </p>
                  {rating.artistName && (
                    <p
                      className="text-xs truncate"
                      style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}
                    >
                      {rating.artistName}
                    </p>
                  )}
                  <p className="text-xs font-bold mt-0.5 flex items-baseline gap-1.5 min-w-0">
                    <span style={{ color: textColor ?? "var(--profile-accent, var(--color-primary))", flexShrink: 0 }}>
                      {rating.score}/10
                    </span>
                    {rating.review && (
                      <span
                        className="truncate font-normal"
                        style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}
                      >
                        · {rating.review}
                      </span>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 28, color: textColor ?? "var(--color-on-surface-variant)", opacity: 0.35, fontVariationSettings: "'FILL' 1" }}
          >
            album
          </span>
          <p className="text-xs" style={{ color: textColor ?? "var(--color-on-surface-variant)", opacity: 0.5 }}>
            No albums rated yet
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
