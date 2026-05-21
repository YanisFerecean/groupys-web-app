import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

// ── Backend response types ──────────────────────────────────────────────────

interface BackendArtist {
  id: number;
  name: string;
  images: string[];
}

interface BackendAlbum {
  id: number;
  title: string;
  coverMedium: string;
  coverBig: string;
  artist: BackendArtist;
}

interface BackendTrack {
  id: number;
  title: string;
  preview: string | null;
  artist: BackendArtist;
  album: BackendAlbum;
}

// ── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const type = searchParams.get("type") ?? "track";

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const authHeader = request.headers.get("Authorization");
  let token: string | null = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const { getToken } = await auth();
    token = await getToken();
  }
  if (!token) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }

  try {
    const endpoints: Record<string, string> = {
      track: "/tracks/search",
      artist: "/artists/search",
      album: "/albums/search",
    };
    const endpoint = endpoints[type];
    if (!endpoint) {
      return NextResponse.json({ results: [] });
    }

    const res = await fetch(
      `${API_URL}${endpoint}?q=${encodeURIComponent(query)}&limit=8`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ results: [] }, { status: res.status });
    }

    const data = await res.json();
    const results = mapResults(type, data);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}

// ── Map backend DTOs to frontend result shapes ──────────────────────────────

function mapResults(type: string, data: unknown[]) {
  switch (type) {
    case "track":
      return (data as BackendTrack[]).map((t) => ({
        id: String(t.id),
        title: t.title,
        artist: t.artist.name,
        album: t.album.title,
        coverUrl: t.album.coverBig || t.album.coverMedium,
        preview: t.preview,
      }));
    case "artist":
      return (data as BackendArtist[]).map((a) => ({
        id: String(a.id),
        name: a.name,
        imageUrl: a.images?.[a.images.length - 1] ?? a.images?.[0] ?? "",
      }));
    case "album":
      return (data as BackendAlbum[]).map((a) => ({
        id: String(a.id),
        title: a.title,
        artist: a.artist.name,
        coverUrl: a.coverBig || a.coverMedium,
      }));
    default:
      return [];
  }
}
