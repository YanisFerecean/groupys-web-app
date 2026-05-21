"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { ArtistSearchResult } from "@/lib/api";
import { searchArtists, fetchArtistsByGenre } from "@/lib/api";

interface ArtistStepProps {
  selected: ArtistSearchResult[];
  onToggle: (artist: ArtistSearchResult) => void;
  selectedGenres?: string[];
}

// Grid card used for genre-based suggestions
function SuggestionCard({
  artist,
  isSelected,
  onToggle,
}: {
  artist: ArtistSearchResult;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const imageUrl = artist.images.find((img) => img.includes("400x400")) || artist.images[artist.images.length - 1];

  return (
    <button
      onClick={onToggle}
      className={`relative rounded-xl overflow-hidden aspect-square w-full transition-all duration-200 ${
        isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""
      }`}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={artist.name}
          fill
          className="object-cover"
          sizes="(max-width: 400px) 30vw, 120px"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <span className="text-3xl font-extrabold text-on-surface-variant">
            {artist.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Bottom gradient + name */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2 pt-6 pb-2">
        <p className="text-white text-xs font-bold truncate leading-tight">{artist.name}</p>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <span
            className="material-symbols-outlined text-on-primary"
            style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}
          >
            check
          </span>
        </div>
      )}
    </button>
  );
}

// Row card used for search results
function SearchResultCard({
  artist,
  isSelected,
  onToggle,
}: {
  artist: ArtistSearchResult;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const imageUrl = artist.images.find((img) => img.includes("400x400")) || artist.images[0];

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-3 p-3 rounded-2xl w-full text-left transition-all duration-200 border ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-transparent bg-surface-container hover:bg-surface-container-high"
      }`}
    >
      <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={artist.name}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <span className="text-xl font-bold text-on-surface-variant">
            {artist.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-on-surface truncate">{artist.name}</p>
        {artist.primaryGenre && (
          <span className="inline-block mt-0.5 bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase">
            {artist.primaryGenre.name}
          </span>
        )}
      </div>

      <div
        className={`ml-auto flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
          isSelected ? "bg-primary border-primary" : "border-outline-variant"
        }`}
      >
        {isSelected && (
          <span
            className="material-symbols-outlined text-on-primary"
            style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}
          >
            check
          </span>
        )}
      </div>
    </button>
  );
}

export default function ArtistStep({ selected, onToggle, selectedGenres = [] }: ArtistStepProps) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<ArtistSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ArtistSearchResult[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  useEffect(() => {
    if (selectedGenres.length === 0) return;
    setIsLoadingSuggestions(true);
    getTokenRef.current().then(async (token) => {
      try {
        const perGenre = Math.ceil(12 / selectedGenres.length);
        const all = await Promise.all(
          selectedGenres.map((g) => fetchArtistsByGenre(g, token, perGenre))
        );
        const seen = new Set<string>();
        const deduped: ArtistSearchResult[] = [];
        for (const batch of all) {
          for (const artist of batch) {
            if (!seen.has(artist.id)) {
              seen.add(artist.id);
              deduped.push(artist);
            }
          }
        }
        setSuggestions(deduped.slice(0, 12));
      } catch {
        // suggestions are non-critical, silently fail
      } finally {
        setIsLoadingSuggestions(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim().length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const search = async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const token = await getTokenRef.current();
        const data = await searchArtists(debouncedQuery.trim(), token, 8);
        setResults(data);
      } catch {
        setSearchError("Search failed. Try again.");
      } finally {
        setIsSearching(false);
      }
    };

    search();
  }, [debouncedQuery]);

  const selectedIds = new Set(selected.map((a) => a.id));
  const isQueryActive = searchOpen && query.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">
            Who do you love?
          </h2>
          <p className="text-on-surface-variant text-sm">
            Pick at least one favourite artist.
          </p>
        </div>
        <button
          onClick={() => {
            setSearchOpen((prev) => {
              const next = !prev;
              if (next) setTimeout(() => inputRef.current?.focus(), 50);
              if (!next) { setQuery(""); setResults([]); }
              return next;
            });
          }}
          className={`flex-shrink-0 mt-1 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
            searchOpen
              ? "bg-primary text-on-primary"
              : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            {searchOpen ? "close" : "search"}
          </span>
        </button>
      </div>

      {/* Search input — shown only when open */}
      {searchOpen && (
        <div className="relative">
          <span
            className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60"
            style={{ fontSize: 18 }}
          >
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists…"
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-medium"
          />
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((a) => (
            <button
              key={a.id}
              onClick={() => onToggle(a)}
              className="flex items-center gap-1.5 pl-2 pr-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold hover:bg-primary/20 transition-colors"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}
              >
                close
              </span>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Search results (scrollable list) */}
      {isQueryActive && (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {isSearching && (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[72px] bg-surface-container-high rounded-2xl animate-pulse" />
              ))}
            </>
          )}

          {!isSearching && searchError && (
            <p className="text-sm text-error text-center py-4">{searchError}</p>
          )}

          {!isSearching && !searchError && results.length === 0 && (
            <p className="text-sm text-on-surface-variant text-center py-6">No artists found for &quot;{query}&quot;</p>
          )}

          {!isSearching && results.map((artist) => (
            <SearchResultCard
              key={artist.id}
              artist={artist}
              isSelected={selectedIds.has(artist.id)}
              onToggle={() => onToggle(artist)}
            />
          ))}
        </div>
      )}

      {/* Genre-based suggestions (grid, no scroll) */}
      {!isQueryActive && (
        <>
          {isLoadingSuggestions && (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-surface-container-high animate-pulse" />
              ))}
            </div>
          )}

          {!isLoadingSuggestions && suggestions.length > 0 && (
            <>
              <p className="text-xs font-bold text-on-surface-variant/50 uppercase tracking-wider">
                Based on your genres
              </p>
              <div className="grid grid-cols-4 gap-2">
                {suggestions.map((artist) => (
                  <SuggestionCard
                    key={artist.id}
                    artist={artist}
                    isSelected={selectedIds.has(artist.id)}
                    onToggle={() => onToggle(artist)}
                  />
                ))}
              </div>
            </>
          )}

          {!isLoadingSuggestions && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-on-surface-variant/40">
              <span className="material-symbols-outlined" style={{ fontSize: 48 }}>
                search
              </span>
              <p className="text-sm font-medium">Search for artists you love</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
