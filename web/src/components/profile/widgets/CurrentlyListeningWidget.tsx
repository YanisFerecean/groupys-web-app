"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import type { ProfileCustomization } from "@/types/profile";
import { fetchMusicCurrentlyPlaying } from "@/lib/appleMusic";
import { getContrastColor } from "@/lib/utils";
import WidgetCard from "./WidgetCard";

const POLL_INTERVAL = 30_000;

interface CurrentlyListeningWidgetProps {
  track?: ProfileCustomization["currentlyListening"];
  musicConnected?: boolean;
  containerColor?: string;
  size?: "small" | "normal";
}

export default function CurrentlyListeningWidget({
  track: savedTrack,
  musicConnected,
  containerColor,
  size = "normal",
}: CurrentlyListeningWidgetProps) {
  const { getToken } = useAuth();
  const [liveTrack, setLiveTrack] = useState(savedTrack);
  const [resolvedPreview, setResolvedPreview] = useState<string | undefined>(savedTrack?.preview);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!musicConnected) return;

    async function poll() {
      const token = await getToken();
      if (!token) return;
      try {
        const data = await fetchMusicCurrentlyPlaying(token);
        setLiveTrack(data ?? savedTrack);
      } catch {
        // keep showing last known track
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [musicConnected, getToken, savedTrack]);

  // Resolve preview URL for the track when not stored
  useEffect(() => {
    const t = musicConnected ? liveTrack : savedTrack;
    if (t?.preview?.startsWith("http")) {
      setResolvedPreview(t.preview);
      return;
    }
    if (!t?.title) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const q = encodeURIComponent(`${t.title} ${t.artist ?? ""}`.trim());
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/music-search?q=${q}&type=track`, { headers });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const results: { title: string; artist: string; preview?: string | null }[] = data.results ?? [];
        const match =
          results.find(
            (r) =>
              r.title.toLowerCase() === t.title!.toLowerCase() &&
              r.artist.toLowerCase() === (t.artist ?? "").toLowerCase()
          ) ?? results[0];
        if (!cancelled && match?.preview?.startsWith("http")) {
          setResolvedPreview(match.preview);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [liveTrack, savedTrack, musicConnected, getToken]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const track = musicConnected ? liveTrack : savedTrack;
  const textColor = containerColor ? getContrastColor(containerColor) : undefined;

  const handleTrackClick = () => {
    if (!resolvedPreview) return;

    if (isPlaying) {
      audioRef.current?.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(resolvedPreview);
    audioRef.current = audio;

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      audioRef.current = null;
    });

    audio.addEventListener("error", () => {
      setIsPlaying(false);
      audioRef.current = null;
    });

    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
      audioRef.current = null;
    });
  };

  return (
    <WidgetCard
      title="Currently Listening"
      className="h-[260px] overflow-hidden"
      style={containerColor ? { backgroundColor: containerColor } : undefined}
      textColor={textColor}
    >
      {track?.title ? (
        size === "small" ? (
          <div
            className={`flex flex-col gap-3 ${resolvedPreview ? "cursor-pointer group" : ""}`}
            onClick={handleTrackClick}
          >
            {track.coverUrl && (
              <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-md">
                <Image alt={track.title} fill className="object-cover" src={track.coverUrl} />
                {/* Play/Pause overlay */}
                {resolvedPreview && (
                  <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    <span className="material-symbols-outlined text-white text-4xl">
                      {isPlaying ? "pause" : "play_arrow"}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{track.title}</p>
              <p className="text-xs truncate" style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}>
                {track.artist}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {track.coverUrl && (
              <div
                className={`relative w-full rounded-xl overflow-hidden shadow-lg ${resolvedPreview ? "cursor-pointer group" : ""}`}
                style={{ height: 140 }}
                onClick={handleTrackClick}
              >
                <Image
                  alt={track.title}
                  fill
                  className="object-cover"
                  src={track.coverUrl}
                />
                {/* Play/Pause overlay */}
                {resolvedPreview && (
                  <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    <span className="material-symbols-outlined text-white text-5xl">
                      {isPlaying ? "pause" : "play_arrow"}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate">{track.title}</p>
                <p className="text-sm truncate mt-0.5" style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}>
                  {track.artist}
                </p>
              </div>
              {/* Animated equalizer bars (only when actually playing from Apple Music) */}
              {musicConnected && (
                <div className="flex items-end gap-0.5 h-5 shrink-0">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full"
                      style={{
                        backgroundColor: textColor ?? "var(--profile-accent, var(--color-primary))",
                        animation: `equalize 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                        height: `${8 + (i % 3) * 6}px`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        <p className="text-sm" style={textColor ? { color: textColor, opacity: 0.6 } : { color: "var(--color-on-surface-variant)" }}>
          Nothing playing right now.
        </p>
      )}
    </WidgetCard>
  );
}
