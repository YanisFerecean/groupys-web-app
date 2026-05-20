import type { ProfileCustomization } from "@/types/profile";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

// ── Backend types ──────────────────────────────────────────────────────────

interface BackendWidget {
  type: string;
  color: string | null;
  pos: number;
  data: Record<string, unknown>;
}

export interface BackendUser {
  id: string;
  clerkId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  country: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  nameColor: string | null;
  profileImage: string | null;
  widgets: string | null;
  tags: string[];
  dateJoined: string;
  musicConnected?: boolean;
  lastFmConnected?: boolean;
  lastFmUsername?: string | null;
}

// ── Widget ↔ ProfileCustomization conversion ───────────────────────────────

export function widgetsToProfile(widgets: BackendWidget[]): Partial<ProfileCustomization> {
  const sorted = [...widgets].sort((a, b) => a.pos - b.pos);
  const result: Partial<ProfileCustomization> = { showHotTake: false };

  result.widgetOrder = sorted.map((w) => w.type);

  for (const w of sorted) {
    const items = (w.data?.items ?? []) as Record<string, string>[];

    const widgetSize = w.data?.size as string | undefined;

    switch (w.type) {
    case "topSongs":
      result.topSongs = items.map((i) => ({
        title: i.title,
        artist: i.artist,
        coverUrl: i.coverUrl,
        preview: i.preview ?? i.previewUrl,
      }));
        result.songsContainerColor = w.color ?? undefined;
        if (widgetSize) result.widgetSizes = { ...result.widgetSizes, topSongs: widgetSize as "small" | "normal" };
        if (w.data?.synced) result.musicSynced = { ...result.musicSynced, topSongs: true };
        if (w.data?.hidden) result.hiddenWidgets = [...(result.hiddenWidgets ?? []), "topSongs"];
        break;
      case "topArtists":
        result.topArtists = items.map((i) => ({
          id: i.id,
          name: i.name,
          genre: i.genre,
          imageUrl: i.imageUrl,
        }));
        result.artistsContainerColor = w.color ?? undefined;
        if (widgetSize) result.widgetSizes = { ...result.widgetSizes, topArtists: widgetSize as "small" | "normal" };
        if (w.data?.synced) result.musicSynced = { ...result.musicSynced, topArtists: true };
        if (w.data?.hidden) result.hiddenWidgets = [...(result.hiddenWidgets ?? []), "topArtists"];
        break;
      case "topAlbums":
        result.topAlbums = items.map((i) => ({
          id: i.id,
          title: i.title,
          artist: i.artist,
          coverUrl: i.coverUrl,
        }));
        result.albumsContainerColor = w.color ?? undefined;
        if (widgetSize) result.widgetSizes = { ...result.widgetSizes, topAlbums: widgetSize as "small" | "normal" };
        if (w.data?.synced) result.musicSynced = { ...result.musicSynced, topAlbums: true };
        if (w.data?.hidden) result.hiddenWidgets = [...(result.hiddenWidgets ?? []), "topAlbums"];
        break;
      case "lastRatedAlbum":
        result.showLastRatedAlbum = true;
        result.lastRatedAlbumContainerColor = w.color ?? undefined;
        if (widgetSize) result.widgetSizes = { ...result.widgetSizes, lastRatedAlbum: widgetSize as "small" | "normal" };
        if (w.data?.hidden) result.hiddenWidgets = [...(result.hiddenWidgets ?? []), "lastRatedAlbum"];
        break;
      case "hotTake":
        result.showHotTake = (w.data?.show as boolean | undefined) !== false;
        result.hotTakeContainerColor = w.color ?? undefined;
        if (widgetSize) result.widgetSizes = { ...result.widgetSizes, hotTake: widgetSize as "small" | "normal" };
        if (w.data?.hidden) result.hiddenWidgets = [...(result.hiddenWidgets ?? []), "hotTake"];
        break;
    case "currentlyListening": {
      const d = w.data as Record<string, string>;
      if (d.title) {
        result.currentlyListening = {
          title: d.title,
          artist: d.artist,
          coverUrl: d.coverUrl,
          preview: d.preview,
        };
      }
        result.currentlyListeningContainerColor = w.color ?? undefined;
        if (widgetSize) result.widgetSizes = { ...result.widgetSizes, currentlyListening: widgetSize as "small" | "normal" };
        if (w.data?.synced) result.musicSynced = { ...result.musicSynced, currentlyListening: true };
        if (w.data?.hidden) result.hiddenWidgets = [...(result.hiddenWidgets ?? []), "currentlyListening"];
        break;
      }
    }
  }

  return result;
}

function profileToWidgets(profile: Partial<ProfileCustomization>): BackendWidget[] {
  type W = Omit<BackendWidget, "pos">;
  const widgetData: Partial<Record<string, W>> = {};

  const synced = profile.musicSynced ?? {};
  const hidden = profile.hiddenWidgets ?? [];
  if (profile.topAlbums?.length) {
    widgetData.topAlbums = { type: "topAlbums", color: profile.albumsContainerColor ?? null, data: { items: profile.topAlbums, size: profile.widgetSizes?.topAlbums ?? null, synced: synced.topAlbums ?? false, hidden: hidden.includes("topAlbums") } };
  }
  if (profile.currentlyListening?.title) {
    widgetData.currentlyListening = { type: "currentlyListening", color: profile.currentlyListeningContainerColor ?? null, data: { ...profile.currentlyListening, size: profile.widgetSizes?.currentlyListening ?? null, synced: synced.currentlyListening ?? false, hidden: hidden.includes("currentlyListening") } };
  }
  if (profile.topSongs?.length) {
    widgetData.topSongs = { type: "topSongs", color: profile.songsContainerColor ?? null, data: { items: profile.topSongs, size: profile.widgetSizes?.topSongs ?? null, synced: synced.topSongs ?? false, hidden: hidden.includes("topSongs") } };
  }
  if (profile.showLastRatedAlbum) {
    widgetData.lastRatedAlbum = { type: "lastRatedAlbum", color: profile.lastRatedAlbumContainerColor ?? null, data: { size: profile.widgetSizes?.lastRatedAlbum ?? null, hidden: hidden.includes("lastRatedAlbum") } };
  }
  if (profile.showHotTake === true) {
    widgetData.hotTake = { type: "hotTake", color: profile.hotTakeContainerColor ?? null, data: { show: true, size: profile.widgetSizes?.hotTake ?? null, hidden: hidden.includes("hotTake") } };
  }
  if (profile.topArtists?.length) {
    widgetData.topArtists = { type: "topArtists", color: profile.artistsContainerColor ?? null, data: { items: profile.topArtists, size: profile.widgetSizes?.topArtists ?? null, synced: synced.topArtists ?? false, hidden: hidden.includes("topArtists") } };
  }

  const defaultOrder = ["topAlbums", "currentlyListening", "topSongs", "lastRatedAlbum", "topArtists"];
  const order = profile.widgetOrder ?? defaultOrder;

  const widgets: BackendWidget[] = [];
  let pos = 0;

  // Emit widgets in the saved order first
  for (const type of order) {
    const w = widgetData[type];
    if (w) {
      widgets.push({ ...w, pos: pos++ });
      delete widgetData[type];
    }
  }

  // Then any remaining widgets not covered by the order
  for (const w of Object.values(widgetData)) {
    if (w) widgets.push({ ...w, pos: pos++ });
  }

  return widgets;
}

// ── JSON parsing helper ───────────────────────────────────────────────────

export function parseWidgets(raw: string | null): BackendWidget[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BackendWidget[];
  } catch {
    return [];
  }
}

// ── Conversion helpers ─────────────────────────────────────────────────────

export function backendUserToProfile(user: BackendUser): ProfileCustomization {
  return {
    displayName: user.displayName ?? undefined,
    bio: user.bio ?? undefined,
    country: user.country ?? undefined,
    bannerUrl: user.bannerUrl ?? undefined,
    accentColor: user.accentColor ?? undefined,
    nameColor: user.nameColor ?? undefined,
    tags: user.tags ?? [],
    ...widgetsToProfile(parseWidgets(user.widgets)),
  };
}

// ── API calls ──────────────────────────────────────────────────────────────

type JsonRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function requireToken(token: string | null): string {
  if (!token) {
    throw new Error("Missing Clerk session token for authenticated API request");
  }

  return token;
}

async function apiRequest(
  path: string,
  token: string | null,
  init: JsonRequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${requireToken(token)}`);

  const { body, ...rest } = init;
  const requestInit: RequestInit = {
    ...rest,
    headers,
  };

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    requestInit.body = JSON.stringify(body);
  }

  return fetch(`${API_URL}${path}`, requestInit);
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.text().catch(() => "");
  return body ? `${fallback} (${res.status}): ${body}` : `${fallback} (${res.status})`;
}

export async function fetchUserByClerkId(
  clerkId: string,
  token: string | null,
): Promise<BackendUser | null> {
  const res = await apiRequest(`/users/clerk/${encodeURIComponent(clerkId)}`, token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to fetch user profile"));
  return res.json();
}

export async function createBackendUser(
  data: {
    clerkId: string;
    username: string;
    displayName?: string;
    bio?: string;
    profileImage?: string;
  },
  token: string | null,
): Promise<BackendUser> {
  const res = await apiRequest("/users", token, {
    method: "POST",
    body: data,
  });

  if (res.status === 409) {
    // User already exists (race condition) — fetch and return
    const existing = await fetchUserByClerkId(data.clerkId, token);
    if (existing) return existing;
  }

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to create user"));
  }
  return res.json();
}

// ── Album Ratings ──────────────────────────────────────────────────────────

export interface AlbumRatingRes {
  id: string;
  albumId: number;
  albumTitle: string;
  albumCoverUrl: string | null;
  artistName: string | null;
  userId: string;
  username: string;
  displayName: string | null;
  profileImage: string | null;
  score: number;
  review: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumRatingCreate {
  albumId: number;
  albumTitle: string;
  albumCoverUrl: string | null;
  artistName: string | null;
  score: number;
  review: string | null;
}

export async function upsertAlbumRating(
  data: AlbumRatingCreate,
  token: string | null,
): Promise<AlbumRatingRes> {
  const res = await apiRequest("/album-ratings", token, {
    method: "POST",
    body: data,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to save rating"));
  return res.json();
}

export async function fetchAlbumRatings(
  albumId: number,
  token: string | null,
): Promise<AlbumRatingRes[]> {
  const res = await apiRequest(`/album-ratings/album/${albumId}`, token);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to fetch ratings"));
  return res.json();
}

export async function fetchMyAlbumRatings(
  token: string | null,
): Promise<AlbumRatingRes[]> {
  const res = await apiRequest("/album-ratings/mine", token);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to fetch your ratings"));
  return res.json();
}

export async function fetchUserAlbumRatings(
  username: string,
  token: string | null,
): Promise<AlbumRatingRes[]> {
  const res = await apiRequest(`/album-ratings/user/${encodeURIComponent(username)}`, token);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to fetch ratings"));
  return res.json();
}

export async function deleteAlbumRating(
  ratingId: string,
  token: string | null,
): Promise<void> {
  const res = await apiRequest(`/album-ratings/${encodeURIComponent(ratingId)}`, token, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to delete rating"));
}

// ── Community search ──────────────────────────────────────────────────────

export interface CommunityRes {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  imageUrl: string | null;
  iconType: string | null;
  iconEmoji: string | null;
  iconUrl: string | null;
  memberCount: number;
  tags: string[];
}

export async function searchCommunities(
  query: string,
  token: string | null,
  limit = 9,
): Promise<CommunityRes[]> {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await apiRequest(`/communities/search?${params}`, token);
  if (!res.ok) throw new Error("Failed to search communities");
  return res.json();
}

export async function searchUsers(
  query: string,
  token: string | null,
  limit = 9,
): Promise<BackendUser[]> {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await apiRequest(`/users/search?${params}`, token);
  if (!res.ok) throw new Error("Failed to search users");
  return res.json();
}

const WIDGET_FIELDS: (keyof ProfileCustomization)[] = [
  "topAlbums", "topSongs", "topArtists", "currentlyListening",
  "showLastRatedAlbum", "showHotTake", "widgetOrder", "hiddenWidgets",
  "widgetSizes", "musicSynced", "albumsContainerColor", "songsContainerColor",
  "artistsContainerColor", "currentlyListeningContainerColor",
  "lastRatedAlbumContainerColor", "hotTakeContainerColor",
];

export async function updateBackendUser(
  userId: string,
  data: Partial<ProfileCustomization>,
  token: string | null,
): Promise<BackendUser> {
  const hasWidgetData = WIDGET_FIELDS.some(f => f in data);
  const body = {
    displayName: data.displayName ?? null,
    bio: data.bio ?? null,
    country: data.country ?? null,
    bannerUrl: data.bannerUrl ?? null,
    accentColor: data.accentColor ?? null,
    nameColor: data.nameColor ?? null,
    profileImage: data.profileImage ?? null,
    widgets: hasWidgetData ? JSON.stringify(profileToWidgets(data)) : null,
    tags: data.tags ?? null,
  };

  const res = await apiRequest(`/users/${encodeURIComponent(userId)}`, token, {
    method: "PUT",
    body,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to update user profile"));
  return res.json();
}

// ── Artist search ──────────────────────────────────────────────────────────

export interface ArtistSearchResult {
  id: string;
  name: string;
  primaryGenre: { id: string; name: string } | null;
  images: string[];
  listeners: number;
  summary: string;
}

export async function searchArtists(
  query: string,
  token: string | null,
  limit = 8,
): Promise<ArtistSearchResult[]> {
  if (!query || query.trim().length === 0) return [];
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  const res = await apiRequest(`/artists/search?${params}`, token);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to search artists"));
  return res.json();
}

export async function fetchArtistsByGenre(
  genre: string,
  token: string | null,
  limit = 8,
): Promise<ArtistSearchResult[]> {
  if (!genre) return [];
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await apiRequest(`/artists/genre/${encodeURIComponent(genre)}?${params}`, token);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to fetch artists by genre"));
  return res.json();
}

// ── Community by genre ────────────────────────────────────────────────────

export async function fetchCommunitiesByArtist(
  artistId: string,
  token: string | null,
): Promise<CommunityRes[]> {
  if (!artistId) return [];
  const res = await apiRequest(`/communities/artist/${encodeURIComponent(artistId)}`, token);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to fetch communities by artist"));
  return res.json();
}

export async function fetchCommunitiesByGenre(
  genre: string,
  token: string | null,
): Promise<CommunityRes[]> {
  if (!genre) return [];
  const res = await apiRequest(`/communities/genre/${encodeURIComponent(genre)}`, token);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to fetch communities by genre"));
  return res.json();
}

// ── Onboarding artist preferences ─────────────────────────────────────────

export async function saveOnboardingArtists(
  artistIds: string[],
  token: string | null,
): Promise<void> {
  if (!artistIds.length) return;
  const res = await apiRequest("/discovery/onboarding/artists", token, {
    method: "POST",
    body: artistIds.map(Number),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to save artist preferences"));
}

// ── Community join ────────────────────────────────────────────────────────

export async function joinCommunity(
  communityId: string,
  token: string | null,
): Promise<void> {
  const res = await apiRequest(`/communities/${encodeURIComponent(communityId)}/join`, token, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to join community"));
}

export async function uploadProfileBanner(
  file: File,
  token: string | null,
): Promise<BackendUser> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${requireToken(token)}`);

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/users/banner`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to upload banner"));
  return res.json();
}
