"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchCommunities, searchUsers, type BackendUser, type CommunityRes } from "@/lib/api";
import { submitHotTakeAnswer, type HotTakeRes } from "@/lib/hot-take-api";
import MusicSearchInput, {
  type ArtistResult,
  type TrackResult,
  type AlbumResult,
} from "@/components/profile/MusicSearchInput";

interface Pending {
  name: string;
  imageUrl: string | null;
  musicType: string;
}

function UserSearchInput({ onSelect, token }: { onSelect: (name: string, img: string | null) => void; token: string | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BackendUser[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (q.length < 2) { setResults([]); setOpen(false); return; }
      try { const d = await searchUsers(q, token); setResults(d); setOpen(d.length > 0); } catch { setResults([]); }
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input value={query} onChange={(e) => handleChange(e.target.value)} onFocus={() => { if (results.length > 0) setOpen(true); }} placeholder="Search for a user..." />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-surface-container bg-surface shadow-xl">
          {results.map((r) => (
            <button key={r.id} type="button" className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-low transition-colors" onClick={() => { onSelect(r.displayName ?? r.username, r.profileImage ?? null); setOpen(false); setQuery(""); setResults([]); }}>
              {r.profileImage ? (
                <Image src={r.profileImage} alt={r.username} width={40} height={40} className="rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-base">person</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{r.displayName ?? r.username}</p>
                <p className="text-xs text-on-surface-variant truncate">@{r.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunitySearchInput({ onSelect, token }: { onSelect: (name: string, img: string | null) => void; token: string | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunityRes[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (q.length < 2) { setResults([]); setOpen(false); return; }
      try { const d = await searchCommunities(q, token); setResults(d); setOpen(d.length > 0); } catch { setResults([]); }
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input value={query} onChange={(e) => handleChange(e.target.value)} onFocus={() => { if (results.length > 0) setOpen(true); }} placeholder="Search for a community..." />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-surface-container bg-surface shadow-xl">
          {results.map((r) => (
            <button key={r.id} type="button" className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-low transition-colors" onClick={() => { onSelect(r.name, null); setOpen(false); setQuery(""); setResults([]); }}>
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{r.name}</p>
                {r.genre && <p className="text-xs text-on-surface-variant truncate">{r.genre}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface HotTakeAnswerModalProps {
  open: boolean;
  hotTake: HotTakeRes;
  onClose: () => void;
  onAnswered: () => void;
}

export default function HotTakeAnswerModal({ open, hotTake, onClose, onAnswered }: HotTakeAnswerModalProps) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const [token, setToken] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pending[]>([]);
  const [freeTexts, setFreeTexts] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);

  const count = hotTake.answerCount;
  const answerType = hotTake.answerType;
  const isFreeText = answerType === "FREETEXT";

  useEffect(() => {
    if (open) {
      getTokenRef.current().then(setToken);
      setPicks([]);
      setFreeTexts(Array(count).fill(""));
    }
  }, [open, count]);

  const canSubmit = isFreeText
    ? freeTexts.length === count && freeTexts.every(t => t.trim().length > 0)
    : picks.length === count;

  const answerTypeIcon =
    answerType === "SONG" ? "music_note" :
    answerType === "ALBUM" ? "album" :
    answerType === "COMMUNITY" ? "group" :
    answerType === "USER" ? "person" :
    "person";

  function addPick(pick: Pending) {
    if (picks.length >= count) return;
    setPicks(prev => [...prev, pick]);
  }

  function removePick(index: number) {
    setPicks(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const tok = await getTokenRef.current();
      const answers = isFreeText ? freeTexts.map(t => t.trim()) : picks.map(p => p.name);
      const imageUrls = isFreeText ? freeTexts.map(() => null) : picks.map(p => p.imageUrl);
      const musicTypes = isFreeText ? freeTexts.map(() => null) : picks.map(p => p.musicType);
      await submitHotTakeAnswer(hotTake.id, answers, imageUrls, musicTypes, false, tok);
      window.dispatchEvent(new Event("hot-take-answered"));
      onAnswered();
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }

  const pickLabel = count > 1 && picks.length < count
    ? `Pick ${picks.length + 1} of ${count}`
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      {/* overflow-hidden removed so absolute dropdowns aren't clipped; header clips itself */}
      <DialogContent className="sm:max-w-md p-0 gap-0">
        {/* Gradient header — clips its own background to the top rounded corners */}
        <div
          className="px-6 pt-6 pb-5 rounded-t-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 75%, black) 100%)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-white/90" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
              local_fire_department
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">
              Hot Take{hotTake.weekLabel ? ` · ${hotTake.weekLabel}` : ""}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold leading-snug text-white text-left">
            {hotTake.question}
          </DialogTitle>

          {/* Multi-pick progress dots */}
          {count > 1 && (
            <div className="flex items-center gap-1.5 mt-4">
              {Array.from({ length: count }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i < picks.length ? 24 : 8,
                    backgroundColor: i < picks.length ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
              <span className="text-xs text-white/60 ml-1">
                {picks.length}/{count}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3 bg-surface-container-low rounded-b-2xl">
          {isFreeText ? (
            freeTexts.map((text, i) => (
              <Input
                key={i}
                value={text}
                onChange={(e) => setFreeTexts(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                placeholder={count > 1 ? `Answer ${i + 1}...` : "Type your answer..."}
                onKeyDown={(e) => { if (e.key === "Enter" && i === freeTexts.length - 1) handleSubmit(); }}
              />
            ))
          ) : (
            <>
              {/* Selected picks */}
              {picks.length > 0 && (
                <div className="space-y-2">
                  {picks.map((pick, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container border border-outline-variant/50">
                      {pick.imageUrl ? (
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-sm">
                          <Image src={pick.imageUrl} alt={pick.name} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>{answerTypeIcon}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {count > 1 && <p className="text-xs text-on-surface-variant mb-0.5">Pick {i + 1}</p>}
                        <p className="text-sm font-bold truncate">{pick.name}</p>
                      </div>
                      <button type="button" onClick={() => removePick(i)} className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors shrink-0">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search input */}
              {picks.length < count && (
                <div className="space-y-2">
                  {pickLabel && (
                    <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                      {pickLabel}
                    </p>
                  )}
                  {answerType === "ARTIST" ? (
                    <MusicSearchInput type="artist" placeholder="Search for an artist..." onSelect={(r: ArtistResult) => addPick({ name: r.name, imageUrl: r.imageUrl || null, musicType: "ARTIST" })} />
                  ) : answerType === "ALBUM" ? (
                    <MusicSearchInput type="album" placeholder="Search for an album..." onSelect={(r: AlbumResult) => addPick({ name: `${r.title} — ${r.artist}`, imageUrl: r.coverUrl || null, musicType: "ALBUM" })} />
                  ) : answerType === "SONG" ? (
                    <MusicSearchInput type="track" placeholder="Search for a song..." onSelect={(r: TrackResult) => addPick({ name: `${r.title} — ${r.artist}`, imageUrl: r.coverUrl || null, musicType: "SONG" })} />
                  ) : answerType === "USER" ? (
                    <UserSearchInput token={token} onSelect={(name, imageUrl) => addPick({ name, imageUrl, musicType: "USER" })} />
                  ) : answerType === "COMMUNITY" ? (
                    <CommunitySearchInput token={token} onSelect={(name, imageUrl) => addPick({ name, imageUrl, musicType: "COMMUNITY" })} />
                  ) : null}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-3 rounded-2xl text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : count > 1 ? `Submit my ${count} picks` : "Submit my pick"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
