"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";

// ── Result types from /api/music-search ─────────────────────────────────────

export interface TrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  preview?: string;
}

export interface ArtistResult {
  id: string;
  name: string;
  imageUrl: string;
}

export interface AlbumResult {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

type SearchType = "track" | "artist" | "album";

type ResultMap = {
  track: TrackResult;
  artist: ArtistResult;
  album: AlbumResult;
};

// ── Component ───────────────────────────────────────────────────────────────

interface MusicSearchInputProps<T extends SearchType> {
  type: T;
  placeholder?: string;
  onSelect: (result: ResultMap[T]) => void;
  /** Display value shown in the input when an item is already selected */
  displayValue?: string;
}

export default function MusicSearchInput<T extends SearchType>({
  type,
  placeholder,
  onSelect,
  displayValue,
}: MusicSearchInputProps<T>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultMap[T][]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Show displayValue when not actively searching
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/music-search?q=${encodeURIComponent(q)}&type=${type}`,
        );
        const data = await res.json();
        setResults(data.results ?? []);
        setIsOpen(data.results?.length > 0);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [type],
  );

  const handleChange = (value: string) => {
    setQuery(value);
    setIsSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: ResultMap[T]) => {
    onSelect(result);
    setIsOpen(false);
    setIsSearching(false);
    setQuery("");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsSearching(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={isSearching ? query : displayValue ?? query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          setIsSearching(true);
          if (results.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="material-symbols-outlined text-on-surface-variant text-base animate-spin">
            progress_activity
          </span>
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-surface-container bg-surface shadow-xl">
          {results.map((result) => (
            <button
              key={(result as { id: string }).id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-low transition-colors"
              onClick={() => handleSelect(result)}
            >
              {type === "track" && <TrackRow result={result as TrackResult} />}
              {type === "artist" && (
                <ArtistRow result={result as ArtistResult} />
              )}
              {type === "album" && <AlbumRow result={result as AlbumResult} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Result rows ─────────────────────────────────────────────────────────────

function TrackRow({ result }: { result: TrackResult }) {
  return (
    <>
      {result.coverUrl ? (
        <Image
          src={result.coverUrl}
          alt={result.title}
          width={40}
          height={40}
          className="rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant text-base">
            music_note
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{result.title}</p>
        <p className="text-xs text-on-surface-variant truncate">
          {result.artist} &middot; {result.album}
        </p>
      </div>
    </>
  );
}

function ArtistRow({ result }: { result: ArtistResult }) {
  return (
    <>
      {result.imageUrl ? (
        <Image
          src={result.imageUrl}
          alt={result.name}
          width={40}
          height={40}
          className="rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant text-base">
            person
          </span>
        </div>
      )}
      <p className="text-sm font-semibold truncate">{result.name}</p>
    </>
  );
}

function AlbumRow({ result }: { result: AlbumResult }) {
  return (
    <>
      {result.coverUrl ? (
        <Image
          src={result.coverUrl}
          alt={result.title}
          width={40}
          height={40}
          className="rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant text-base">
            album
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{result.title}</p>
        <p className="text-xs text-on-surface-variant truncate">
          {result.artist}
        </p>
      </div>
    </>
  );
}
