"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import {
  fetchCurrentHotTake,
  fetchFriendsHotTakeAnswers,
  fetchMyHotTakeAnswer,
  submitHotTakeAnswer,
  type HotTakeAnswerRes,
  type HotTakeRes,
} from "@/lib/hot-take-api";
import { searchCommunities, searchUsers, type BackendUser, type CommunityRes } from "@/lib/api";
import MusicSearchInput, {
  type ArtistResult,
  type TrackResult,
  type AlbumResult,
} from "@/components/profile/MusicSearchInput";
import { Input } from "@/components/ui/input";
import { useHotTakeStore } from "@/store/hotTakeStore";

interface Pending {
  name: string;
  imageUrl: string | null;
  musicType: string;
}

// ── User / community search inputs ──────────────────────────────────────────

function UserSearchInput({ onSelect, token }: { onSelect: (name: string, imageUrl: string | null) => void; token: string | null }) {
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
      try {
        const data = await searchUsers(q, token);
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input value={query} onChange={(e) => handleChange(e.target.value)} onFocus={() => { if (results.length > 0) setOpen(true); }} placeholder="Search for a user…" />
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

function CommunitySearchInput({ onSelect, token }: { onSelect: (name: string, imageUrl: string | null) => void; token: string | null }) {
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
      try {
        const data = await searchCommunities(q, token);
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input value={query} onChange={(e) => handleChange(e.target.value)} onFocus={() => { if (results.length > 0) setOpen(true); }} placeholder="Search for a community…" />
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

// ── Friends picks row ────────────────────────────────────────────────────────

function FriendPickRow({ answer }: { answer: HotTakeAnswerRes }) {
  const first = answer.answers[0];
  const firstImage = answer.imageUrls[0] ?? null;
  const extra = answer.answers.length - 1;

  return (
    <div className="flex items-center gap-3 py-2.5">
      {answer.profileImage ? (
        <Image src={answer.profileImage} alt={answer.displayName ?? answer.username} width={32} height={32} className="rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>person</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-on-surface truncate">{answer.displayName ?? answer.username}</p>
        <p className="text-xs text-on-surface-variant truncate">
          {first}{extra > 0 ? ` +${extra} more` : ""}
        </p>
      </div>
      {firstImage && (
        <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
          <Image src={firstImage} alt={first} fill className="object-cover" />
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function HotTakeCard() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const [hotTake, setHotTake] = useState<HotTakeRes | null>(null);
  const [myAnswer, setMyAnswer] = useState<HotTakeAnswerRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Multi-pick state
  const [picks, setPicks] = useState<Pending[]>([]);
  const [freeTexts, setFreeTexts] = useState<string[]>([""]);

  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const setHasUnanswered = useHotTakeStore((s) => s.setHasUnanswered);

  const [friendsAnswers, setFriendsAnswers] = useState<HotTakeAnswerRes[]>([]);
  const [friendsExpanded, setFriendsExpanded] = useState(false);

  const loadFriends = useCallback(async () => {
    const token = await getTokenRef.current();
    const data = await fetchFriendsHotTakeAnswers(token);
    setFriendsAnswers(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tok = await getTokenRef.current();
        const [ht, answer] = await Promise.all([
          fetchCurrentHotTake(),
          fetchMyHotTakeAnswer(tok),
        ]);
        if (!cancelled) {
          setToken(tok);
          setHotTake(ht);
          setMyAnswer(answer);
          if (ht) setFreeTexts(Array(ht.answerCount).fill(""));
          if (ht && localStorage.getItem(`hot-take-dismissed-${ht.id}`) === "1") {
            setDismissed(true);
          }
          if (answer) loadFriends();
        }
      } catch {
        // silently fail — card just won't render
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadFriends]);

  // Listen for answer events from the sidebar modal or profile widget
  useEffect(() => {
    const handler = async () => {
      const token = await getTokenRef.current();
      const answer = await fetchMyHotTakeAnswer(token);
      setMyAnswer(answer);
      setEditing(false);
      if (answer) {
        loadFriends();
        setFriendsExpanded(true);
      }
    };
    window.addEventListener("hot-take-answered", handler);
    return () => window.removeEventListener("hot-take-answered", handler);
  }, [loadFriends]);

  async function handleSubmit() {
    if (!hotTake) return;
    const isFreeText = hotTake.answerType === "FREETEXT";
    if (isFreeText && freeTexts.some(t => !t.trim())) return;
    if (!isFreeText && picks.length !== hotTake.answerCount) return;

    setSubmitting(true);
    try {
      const token = await getTokenRef.current();
      const answers = isFreeText ? freeTexts.map(t => t.trim()) : picks.map(p => p.name);
      const imageUrls = isFreeText ? freeTexts.map(() => null) : picks.map(p => p.imageUrl);
      const musicTypes = isFreeText ? freeTexts.map(() => null) : picks.map(p => p.musicType);
      const result = await submitHotTakeAnswer(hotTake.id, answers, imageUrls, musicTypes, false, token);
      setMyAnswer(result);
      setPicks([]);
      setFreeTexts(Array(hotTake.answerCount).fill(""));
      setEditing(false);
      window.dispatchEvent(new Event("hot-take-answered"));
      loadFriends();
      setFriendsExpanded(true);
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartEditing() {
    if (!hotTake) return;
    setEditing(true);
    setPicks([]);
    setFreeTexts(Array(hotTake.answerCount).fill(""));
  }

  function addPick(pick: Pending) {
    if (!hotTake || picks.length >= hotTake.answerCount) return;
    setPicks(prev => [...prev, pick]);
  }

  function removePick(index: number) {
    setPicks(prev => prev.filter((_, i) => i !== index));
  }

  if (loading || !hotTake || dismissed) return null;

  const answerType = hotTake.answerType;
  const answered = !!myAnswer && !editing;
  const isFreeText = answerType === "FREETEXT";
  const count = hotTake.answerCount;
  const canSubmit = isFreeText
    ? freeTexts.length === count && freeTexts.every(t => t.trim().length > 0)
    : picks.length === count;

  const answerTypeIcon =
    answerType === "SONG" ? "music_note" :
    answerType === "ALBUM" ? "album" :
    answerType === "COMMUNITY" ? "group" :
    answerType === "USER" ? "person" :
    "person";

  const pickLabel = count > 1
    ? `Pick ${picks.length + 1} of ${count}`
    : undefined;

  return (
    <div className="rounded-2xl overflow-hidden mb-6 border border-outline-variant shadow-sm">
      {/* ── Red header ── */}
      <div
        className="px-5 pt-5 pb-5"
        style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 75%, black) 100%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="material-symbols-outlined text-white/90"
                style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
              >
                local_fire_department
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-white/70">
                Hot Take{hotTake.weekLabel ? ` · ${hotTake.weekLabel}` : ""}
              </span>
            </div>
            <p className="text-[15px] font-bold text-white leading-snug">
              {hotTake.question}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {answered && (
              <button
                type="button"
                onClick={handleStartEditing}
                className="text-xs font-semibold text-white/60 hover:text-white transition-colors"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => { localStorage.setItem(`hot-take-dismissed-${hotTake.id}`, "1"); setDismissed(true); setHasUnanswered(false); }}
              className="text-white/50 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-surface-container-low">

        {/* Answered state */}
        {answered && myAnswer && (
          <div className="px-5 py-4 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <p className="text-xs font-semibold text-primary">
                {count > 1 ? "Your picks" : "Your pick"}
              </p>
            </div>
            {myAnswer.answers.map((ans, i) => (
              <div key={i} className="flex items-center gap-3">
                {myAnswer.imageUrls[i] ? (
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-sm">
                    <Image src={myAnswer.imageUrls[i]!} alt={ans} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
                    >
                      {myAnswer.musicTypes[i] === "SONG" || myAnswer.musicTypes[i] === "track" ? "music_note" :
                       myAnswer.musicTypes[i] === "ALBUM" || myAnswer.musicTypes[i] === "album" ? "album" :
                       myAnswer.musicTypes[i] === "COMMUNITY" ? "group" :
                       myAnswer.musicTypes[i] === "USER" ? "person" : "local_fire_department"}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {count > 1 && <p className="text-xs text-on-surface-variant mb-0.5">Pick {i + 1}</p>}
                  <p className="font-bold text-sm text-on-surface truncate">{ans}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input state */}
        {!answered && (
          <div className="px-5 py-4 space-y-3">
            {isFreeText ? (
              freeTexts.map((text, i) => (
                <Input
                  key={i}
                  value={text}
                  onChange={(e) => setFreeTexts(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                  placeholder={count > 1 ? `Answer ${i + 1}…` : "Type your answer…"}
                  onKeyDown={(e) => { if (e.key === "Enter" && i === freeTexts.length - 1) handleSubmit(); }}
                />
              ))
            ) : (
              <>
                {/* Selected picks */}
                {picks.map((pick, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container">
                    {pick.imageUrl ? (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        <Image src={pick.imageUrl} alt={pick.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>
                          {answerTypeIcon}
                        </span>
                      </div>
                    )}
                    {count > 1 && <span className="text-xs text-on-surface-variant shrink-0">#{i + 1}</span>}
                    <p className="flex-1 min-w-0 text-sm font-semibold text-on-surface truncate">{pick.name}</p>
                    <button
                      type="button"
                      onClick={() => removePick(i)}
                      className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  </div>
                ))}

                {/* Search input */}
                {picks.length < count && (
                  <div className="space-y-1">
                    {pickLabel && (
                      <p className="text-xs font-semibold text-on-surface-variant">{pickLabel}</p>
                    )}
                    {answerType === "ARTIST" ? (
                      <MusicSearchInput
                        type="artist"
                        placeholder="Search for an artist…"
                        onSelect={(r: ArtistResult) => addPick({ name: r.name, imageUrl: r.imageUrl || null, musicType: "ARTIST" })}
                      />
                    ) : answerType === "ALBUM" ? (
                      <MusicSearchInput
                        type="album"
                        placeholder="Search for an album…"
                        onSelect={(r: AlbumResult) => addPick({ name: `${r.title} — ${r.artist}`, imageUrl: r.coverUrl || null, musicType: "ALBUM" })}
                      />
                    ) : answerType === "SONG" ? (
                      <MusicSearchInput
                        type="track"
                        placeholder="Search for a song…"
                        onSelect={(r: TrackResult) => addPick({ name: `${r.title} — ${r.artist}`, imageUrl: r.coverUrl || null, musicType: "SONG" })}
                      />
                    ) : answerType === "USER" ? (
                      <UserSearchInput
                        token={token}
                        onSelect={(name, imageUrl) => addPick({ name, imageUrl, musicType: "USER" })}
                      />
                    ) : answerType === "COMMUNITY" ? (
                      <CommunitySearchInput
                        token={token}
                        onSelect={(name, imageUrl) => addPick({ name, imageUrl, musicType: "COMMUNITY" })}
                      />
                    ) : null}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : count > 1 ? `Submit my ${count} picks` : "Submit my pick"}
            </button>
          </div>
        )}

        {/* Friends' picks */}
        <div className="border-t border-outline-variant">
          {answered ? (
            <div className="px-5 py-3">
              <button
                type="button"
                onClick={() => setFriendsExpanded((e) => !e)}
                className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors w-full"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>
                See what your friends picked
                <span className="material-symbols-outlined ml-auto" style={{ fontSize: 16 }}>
                  {friendsExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
              {friendsExpanded && (
                <div className="mt-2 divide-y divide-outline-variant">
                  {friendsAnswers.length === 0 ? (
                    <p className="text-xs text-on-surface-variant py-3 text-center">
                      None of your friends have answered yet.
                    </p>
                  ) : (
                    friendsAnswers.map((a) => <FriendPickRow key={a.id} answer={a} />)
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>lock</span>
              <p className="text-xs text-on-surface-variant">Answer to see what your friends picked</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
