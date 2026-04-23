"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  type AlbumRatingRes,
  type AlbumRatingCreate,
  upsertAlbumRating,
  fetchAlbumRatings,
  deleteAlbumRating,
} from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlbumRes {
  id: number;
  title: string;
  coverSmall: string | null;
  coverMedium: string | null;
  coverBig: string | null;
  coverXl: string | null;
  releaseDate: string | null;
  label: string | null;
  duration: number | null;
  nbTracks: number | null;
  fans: number | null;
  genres: string[];
  artist: { id: number; name: string; images: string[] } | null;
  tracks: { id: number; title: string; duration: number | null; preview: string | null; trackPosition: number | null }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-tertiary";
  if (score >= 6) return "text-primary";
  if (score >= 4) return "text-secondary";
  return "text-error";
}

function scoreLabel(score: number): string {
  const labels: Record<number, string> = {
    10: "Masterpiece", 9: "Excellent", 8: "Great", 7: "Good",
    6: "Fine", 5: "Average", 4: "Below Average", 3: "Poor", 2: "Bad", 1: "Terrible",
  };
  return labels[score] ?? "";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScorePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className="p-0.5 transition-transform hover:scale-110 active:scale-95"
            aria-label={`Rate ${star}`}
          >
            <span
              className={`material-symbols-outlined text-[22px] transition-colors ${
                star <= display ? "text-primary" : "text-outline/40"
              }`}
              style={{ fontVariationSettings: star <= display ? "'FILL' 1" : "'FILL' 0" }}
            >
              star
            </span>
          </button>
        ))}
        <span className={`ml-3 text-2xl font-extrabold tabular-nums leading-none ${scoreColor(value)}`}>
          {value}
        </span>
        <span className="text-outline text-sm ml-0.5">/10</span>
      </div>
      <p className={`text-xs font-bold tracking-widest uppercase ${scoreColor(display)}`}>
        {scoreLabel(display)}
      </p>
    </div>
  );
}

function RatingCard({
  rating,
  isOwn,
  onDelete,
}: {
  rating: AlbumRatingRes;
  isOwn: boolean;
  onDelete?: () => void;
}) {
  const date = new Date(rating.updatedAt).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-3 ${isOwn ? "bg-primary/8 border border-primary/20" : "bg-surface-container-lowest border border-outline-variant/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {rating.profileImage ? (
            <Image
              src={rating.profileImage}
              alt={rating.username}
              width={36}
              height={36}
              className="rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
              {(rating.displayName ?? rating.username)[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm text-on-surface truncate">
              {rating.displayName ?? rating.username}
            </p>
            <p className="text-xs text-outline">{date}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-baseline gap-0.5">
            <span className={`text-xl font-extrabold tabular-nums ${scoreColor(rating.score)}`}>
              {rating.score}
            </span>
            <span className="text-outline text-xs">/10</span>
          </div>
          {isOwn && onDelete && (
            <button
              onClick={onDelete}
              className="w-7 h-7 ml-1 rounded-full flex items-center justify-center text-outline/60 hover:text-error hover:bg-error/8 transition-all"
              aria-label="Delete rating"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          )}
        </div>
      </div>
      {rating.review && (
        <p className="text-sm text-on-surface-variant leading-relaxed">{rating.review}</p>
      )}
    </div>
  );
}

function TrackRow({
  track,
  isPlaying,
  isLoading,
  onPress,
}: {
  track: AlbumRes["tracks"][number];
  isPlaying: boolean;
  isLoading: boolean;
  onPress: () => void;
}) {
  const mins = track.duration ? Math.floor(track.duration / 60) : null;
  const secs = track.duration ? track.duration % 60 : null;
  const duration = mins !== null && secs !== null ? `${mins}:${String(secs).padStart(2, "0")}` : null;
  const hasPreview = !!track.preview;

  return (
    <button
      className={`group flex items-center gap-4 w-full text-left px-4 py-3 transition-colors ${
        isPlaying
          ? "bg-primary/8"
          : hasPreview
          ? "hover:bg-surface-container-low cursor-pointer"
          : "cursor-default opacity-50"
      }`}
      onClick={onPress}
      disabled={!hasPreview}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative transition-colors bg-surface-container-high group-hover:bg-surface-container-highest">
        {isLoading ? (
          <span className="material-symbols-outlined text-primary text-base animate-spin">sync</span>
        ) : isPlaying ? (
          <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            pause
          </span>
        ) : hasPreview ? (
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] opacity-0 group-hover:opacity-100 transition-opacity">
            play_arrow
          </span>
        ) : null}
        {!isLoading && !isPlaying && (
          <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-on-surface-variant ${hasPreview ? "group-hover:opacity-0 transition-opacity" : ""}`}>
            {track.trackPosition ?? "·"}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate transition-colors ${isPlaying ? "text-primary" : "text-on-surface"}`}>
          {track.title}
        </p>
      </div>

      {duration && (
        <span className="text-xs text-on-surface-variant tabular-nums shrink-0">{duration}</span>
      )}
    </button>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold tracking-widest uppercase text-outline mb-4">
      {children}
    </h3>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AlbumRatingPage({ id }: { id: string }) {
  const router = useRouter();
  const { getToken } = useAuth();

  const [album, setAlbum] = useState<AlbumRes | null>(null);
  const [albumLoading, setAlbumLoading] = useState(true);
  const [ratings, setRatings] = useState<AlbumRatingRes[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);

  const [score, setScore] = useState(7);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRatingId, setMyRatingId] = useState<string | null>(null);
  const [showTracks, setShowTracks] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const albumId = Number(id);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    (async () => {
      setAlbumLoading(true);
      try {
        const token = await getTokenRef.current();
        const res = await fetch(`${API_URL}/albums/${albumId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setAlbum(await res.json());
      } finally {
        setAlbumLoading(false);
      }
    })();
  }, [albumId]);

  const loadRatings = async () => {
    setRatingsLoading(true);
    try {
      const token = await getTokenRef.current();
      setRatings(await fetchAlbumRatings(albumId, token));
    } finally {
      setRatingsLoading(false);
    }
  };

  useEffect(() => { loadRatings(); }, [albumId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      try {
        const token = await getTokenRef.current();
        const res = await fetch(`${API_URL}/album-ratings/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const mine: AlbumRatingRes[] = await res.json();
        const existing = mine.find((r) => r.albumId === albumId);
        if (existing) {
          setMyRatingId(existing.id);
          setScore(existing.score);
          setReview(existing.review ?? "");
        }
      } catch { /* not critical */ }
    })();
  }, [albumId]);

  const myRating = ratings.find((r) => r.id === myRatingId) ?? null;
  const otherRatings = ratings.filter((r) => r.id !== myRatingId);
  const avgScore = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await getTokenRef.current();
      const payload: AlbumRatingCreate = {
        albumId,
        albumTitle: album?.title ?? String(albumId),
        albumCoverUrl: album?.coverMedium ?? null,
        artistName: album?.artist?.name ?? null,
        score,
        review: review.trim(),
      };
      const saved = await upsertAlbumRating(payload, token);
      setMyRatingId(saved.id);
      await loadRatings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const handleTrackPress = useCallback((track: AlbumRes["tracks"][number]) => {
    if (!track.preview) return;
    if (playingId === track.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);

    setLoadingId(track.id);
    const audio = new Audio(track.preview);
    audioRef.current = audio;
    audio.addEventListener("canplaythrough", () => {
      setLoadingId(null);
      setPlayingId(track.id);
      audio.play();
    });
    audio.addEventListener("ended", () => { setPlayingId(null); audioRef.current = null; });
    audio.addEventListener("error", () => { setLoadingId(null); });
    audio.load();
  }, [playingId]);

  const handleDelete = async () => {
    if (!myRatingId) return;
    setSubmitting(true);
    try {
      const token = await getTokenRef.current();
      await deleteAlbumRating(myRatingId, token);
      setMyRatingId(null);
      setScore(7);
      setReview("");
      await loadRatings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rating");
    } finally {
      setSubmitting(false);
    }
  };

  if (albumLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-primary text-3xl">album</span>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <span className="material-symbols-outlined text-primary text-4xl">error_outline</span>
        <p className="text-on-surface font-bold text-lg">Album not found</p>
        <button onClick={() => router.back()} className="text-primary font-semibold text-sm">
          Go back
        </button>
      </div>
    );
  }

  const cover = album.coverXl ?? album.coverBig ?? album.coverMedium ?? album.coverSmall ?? null;

  return (
    <div className="max-w-4xl mx-auto pb-16">

      {/* ── Album Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-b-3xl lg:rounded-3xl lg:mt-6">
        {/* Blurred background */}
        <div className="absolute inset-0 overflow-hidden">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              className="object-cover scale-110"
              style={{ filter: "blur(28px)", opacity: 0.55 }}
            />
          ) : (
            <div className="w-full h-full bg-surface-container-high" />
          )}
          <div className="absolute inset-0 bg-black/55" />
        </div>

        {/* Header content */}
        <div className="relative px-5 pt-5 pb-8">
          <button
            onClick={() => router.back()}
            className="mb-6 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>

          <div className="flex gap-5 items-end">
            {/* Cover card */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              {cover ? (
                <Image src={cover} alt={album.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl">album</span>
                </div>
              )}
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0 pb-1">
              {album.artist?.name && (
                <button
                  onClick={() => router.push(`/discover/artist/${album.artist!.id}`)}
                  className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-2 hover:text-white/90 transition-colors text-left"
                >
                  {album.artist.name}
                </button>
              )}
              <h1 className="text-white text-xl sm:text-2xl font-extrabold tracking-tight leading-snug mb-3">
                {album.title}
              </h1>
              <div className="flex flex-wrap gap-1.5">
                {album.releaseDate && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-white/65 text-xs">
                    {album.releaseDate.slice(0, 4)}
                  </span>
                )}
                {album.nbTracks != null && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-white/65 text-xs">
                    {album.nbTracks} tracks
                  </span>
                )}
                {album.duration != null && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-white/65 text-xs">
                    {formatTotalDuration(album.duration)}
                  </span>
                )}
                {album.fans != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/65 text-xs">
                    <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    {formatCount(album.fans)}
                  </span>
                )}
                {album.genres.map((g) => (
                  <span key={g} className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/35 text-white text-xs font-medium">
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Community score */}
            {avgScore !== null && (
              <div className="shrink-0 flex flex-col items-center pb-1 px-3 py-2 rounded-xl bg-black/35 backdrop-blur-sm">
                <div className="flex items-baseline gap-0.5">
                  <span className={`text-3xl font-extrabold tabular-nums ${scoreColor(Number(avgScore))}`}>
                    {avgScore}
                  </span>
                  <span className="text-white/60 text-sm ml-0.5">/10</span>
                </div>
                <p className="text-white/60 text-xs mt-0.5 text-center">
                  {ratings.length} {ratings.length === 1 ? "rating" : "ratings"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tracklist toggle ─────────────────────────────────────────────────── */}
      {album.tracks.length > 0 && (
        <div className="px-5 lg:px-6 mt-4">
          <button
            type="button"
            onClick={() => setShowTracks((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 hover:bg-surface-container transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-base text-outline">queue_music</span>
              Tracklist
              <span className="text-outline font-normal">{album.tracks.length}</span>
            </span>
            <span
              className={`material-symbols-outlined text-base text-outline transition-transform duration-200 ${showTracks ? "rotate-180" : ""}`}
            >
              expand_more
            </span>
          </button>
          {showTracks && (
            <div className="mt-2 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden">
              {album.tracks.map((track, i) => (
                <div key={track.id}>
                  <TrackRow
                    track={track}
                    isPlaying={playingId === track.id}
                    isLoading={loadingId === track.id}
                    onPress={() => handleTrackPress(track)}
                  />
                  {i < album.tracks.length - 1 && (
                    <div className="mx-4 h-px bg-outline-variant/30" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="px-5 lg:px-6 mt-6 space-y-8">

        {/* Rate this album */}
        <section>
          <SectionHeading>{myRatingId ? "Your Rating" : "Rate This Album"}</SectionHeading>
          <form
            onSubmit={handleSubmit}
            className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 flex flex-col gap-4"
          >
            <ScorePicker value={score} onChange={setScore} />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-widest uppercase text-outline">Review</label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share your thoughts…"
                rows={3}
                maxLength={2000}
                className="w-full rounded-xl bg-surface-container border border-outline-variant px-3 py-2.5 text-sm text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-outline"
              />
            </div>

            {error && (
              <p className="text-error text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </p>
            )}

            <div className="flex items-center justify-between">
              {myRatingId ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="w-9 h-9 rounded-full border border-outline-variant/60 flex items-center justify-center text-outline hover:text-error hover:border-error/50 hover:bg-error/5 transition-all disabled:opacity-50"
                  aria-label="Delete rating"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              ) : <div />}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-primary text-on-primary font-bold px-8 py-2.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : myRatingId ? "Update" : "Submit Rating"}
              </button>
            </div>
          </form>
        </section>

        {/* Community ratings */}
        {ratingsLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center animate-pulse">
              <span className="material-symbols-outlined text-primary text-base">star</span>
            </div>
          </div>
        )}

        {!ratingsLoading && ratings.length > 0 && (
          <section>
            <SectionHeading>
              Community <span className="font-normal ml-1">{ratings.length}</span>
            </SectionHeading>
            <div className="flex flex-col gap-3">
              {myRating && (
                <RatingCard rating={myRating} isOwn onDelete={handleDelete} />
              )}
              {otherRatings.map((r) => (
                <RatingCard key={r.id} rating={r} isOwn={false} />
              ))}
            </div>
          </section>
        )}

        {!ratingsLoading && ratings.length === 0 && (
          <p className="text-outline text-sm">No ratings yet — be the first!</p>
        )}

      </div>
    </div>
  );
}
