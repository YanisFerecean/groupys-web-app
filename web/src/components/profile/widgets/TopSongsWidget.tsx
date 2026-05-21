"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import type { ProfileCustomization } from "@/types/profile";
import { getContrastColor } from "@/lib/utils";
import WidgetCard from "./WidgetCard";
import { audioPlayer } from "@/lib/audioPlayer";

interface TopSongsWidgetProps {
  songs?: ProfileCustomization["topSongs"];
  containerColor?: string;
  size?: "small" | "normal";
  className?: string;
}

async function resolvePreviewUrl(
  song: { title: string; artist: string; preview?: string },
  token?: string | null,
): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${song.title} ${song.artist}`.trim());
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/music-search?q=${q}&type=track`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const results: { title: string; artist: string; preview?: string | null }[] = data.results ?? [];
    const match =
      results.find(
        (r) =>
          r.title.toLowerCase() === song.title.toLowerCase() &&
          r.artist.toLowerCase() === song.artist.toLowerCase()
      ) ?? results[0];
    return match?.preview?.startsWith("http") ? match.preview : null;
  } catch {
    return null;
  }
}

export default function TopSongsWidget({ songs, containerColor, size = "normal", className }: TopSongsWidgetProps) {
  const { getToken } = useAuth();
  const textColor = containerColor ? getContrastColor(containerColor) : undefined;
  const coverSize = 48;
  const visibleSongs = useMemo(() => songs?.slice(0, size === "small" ? 1 : 3) ?? [], [songs, size]);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [resolvedPreviews, setResolvedPreviews] = useState<Record<number, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Resolve preview URLs for all visible songs
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const entries = await Promise.all(
        visibleSongs.map(async (song, i) => {
          const url = await resolvePreviewUrl(song, token);
          return [i, url] as const;
        })
      );
      if (cancelled) return;
      const map: Record<number, string> = {};
      for (const [i, url] of entries) {
        if (url) map[i] = url;
      }
      setResolvedPreviews(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleSongs, getToken]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioPlayer.stop();
        audioRef.current = null;
      }
    };
  }, []);

  const handleSongClick = (index: number) => {
    const previewUrl = resolvedPreviews[index];

    if (playingIndex === index) {
      audioPlayer.stop();
      audioRef.current = null;
      setPlayingIndex(null);
      return;
    }

    if (!previewUrl) return;

    const audio = audioPlayer.play(previewUrl, () => {
      setPlayingIndex(null);
      audioRef.current = null;
    });
    audioRef.current = audio;

    audio.play().then(() => {
      setPlayingIndex(index);
    }).catch(() => {
      setPlayingIndex(null);
      audioRef.current = null;
    });
  };

  const isPlaying = (index: number) => playingIndex === index;
  const hasPreview = (index: number) => !!resolvedPreviews[index];

  return (
    <WidgetCard
      title={size === "small" ? "Top Song" : "Top Songs"}
      className={className ?? "h-[260px] overflow-hidden"}
      style={containerColor ? { backgroundColor: containerColor } : undefined}
      textColor={textColor}
    >
      {visibleSongs.length > 0 ? (
        size === "small" ? (
          <div className="flex flex-col gap-3">
            <div
              className={`relative w-full aspect-square ${hasPreview(0) ? "cursor-pointer group" : ""}`}
              onClick={() => handleSongClick(0)}
            >
              {visibleSongs[0].coverUrl ? (
                <Image
                  src={visibleSongs[0].coverUrl}
                  alt={visibleSongs[0].title}
                  fill
                  className="rounded-xl object-cover shadow-md"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-surface-container-high flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl">music_note</span>
                </div>
              )}
              <span className="absolute top-2 left-2 text-xs font-bold w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center">
                1
              </span>
              {hasPreview(0) && (
                <div className={`absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl transition-opacity ${isPlaying(0) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  <span className="material-symbols-outlined text-white text-4xl">
                    {isPlaying(0) ? "pause" : "play_arrow"}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{visibleSongs[0].title}</p>
              <p className="text-xs truncate" style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}>
                {visibleSongs[0].artist}
              </p>
            </div>
          </div>
        ) : (
          <ol className="space-y-3">
            {visibleSongs.map((song, i) => (
              <li
                key={i}
                className={`flex items-center gap-3 ${hasPreview(i) ? "cursor-pointer group" : ""}`}
                onClick={() => handleSongClick(i)}
              >
                <span
                  className="text-xs font-bold w-5 text-center shrink-0"
                  style={{ color: textColor ?? "var(--profile-accent, var(--color-primary))" }}
                >
                  {i + 1}
                </span>
                <div className={`relative shrink-0 ${hasPreview(i) ? "group-hover:opacity-80" : ""}`}>
                  {song.coverUrl ? (
                    <Image
                      src={song.coverUrl}
                      alt={song.title}
                      width={coverSize}
                      height={coverSize}
                      className="rounded object-cover"
                    />
                  ) : (
                    <div className="rounded bg-surface-container-high flex items-center justify-center" style={{ width: coverSize, height: coverSize }}>
                      <span className="material-symbols-outlined text-on-surface-variant text-lg">music_note</span>
                    </div>
                  )}
                  {hasPreview(i) && (
                    <div className={`absolute inset-0 flex items-center justify-center bg-black/40 rounded transition-opacity ${isPlaying(i) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      <span className="material-symbols-outlined text-white text-lg">
                        {isPlaying(i) ? "pause" : "play_arrow"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{song.title}</p>
                  <p className="text-xs truncate" style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}>
                    {song.artist}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )
      ) : (
        <p className="text-sm" style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}>
          No top songs set. Edit your profile to add some.
        </p>
      )}
    </WidgetCard>
  );
}
