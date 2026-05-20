"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { startConversation } from "@/lib/chat-api";
import {
  fetchFriendStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineOrCancelRequest,
  removeFriend,
  type FriendStatus,
} from "@/lib/friends-api";
import type { ProfileCustomization } from "@/types/profile";
import {
  type BackendUser,
  backendUserToProfile,
  fetchUserAlbumRatings,
} from "@/lib/api";
import { countryFlag } from "@/lib/countries";
import { getContrastColor } from "@/lib/utils";
import ProfileWidgetGrid from "./ProfileWidgetGrid";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

const DEFAULT_BANNER =
  "linear-gradient(135deg, #1a1c1d 0%, #2f3132 40%, #5d3f3f 100%)";

function bannerBackground(value?: string): React.CSSProperties {
  if (!value) return { backgroundImage: DEFAULT_BANNER };
  if (
    value.startsWith("linear-gradient") ||
    value.startsWith("radial-gradient")
  ) {
    return { backgroundImage: value };
  }
  const url = value.startsWith("/") ? `${API_URL.replace(/\/api$/, "")}${value}` : value;
  return { backgroundImage: `url(${url})` };
}

export default function PublicProfileView({
  username,
}: {
  username: string;
}) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [profile, setProfile] = useState<ProfileCustomization>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [albumsRatedCount, setAlbumsRatedCount] = useState<number | null>(null);
  const [postsCount, setPostsCount] = useState<number | null>(null);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [messagingConversationId, setMessagingConversationId] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("NONE");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendLoading, setFriendLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  async function handleFriend() {
    if (!backendUser || friendLoading) return;
    setFriendLoading(true);
    try {
      const token = await getToken();
      if (friendStatus === "NONE") {
        const res = await sendFriendRequest(backendUser.id, token);
        setFriendStatus("PENDING_SENT");
        setFriendshipId(res.friendshipId);
      } else if (friendStatus === "PENDING_SENT" && friendshipId) {
        await declineOrCancelRequest(friendshipId, token);
        setFriendStatus("NONE");
        setFriendshipId(null);
      } else if (friendStatus === "PENDING_RECEIVED" && friendshipId) {
        await acceptFriendRequest(friendshipId, token);
        setFriendStatus("ACCEPTED");
      } else if (friendStatus === "ACCEPTED") {
        await removeFriend(backendUser.id, token);
        setFriendStatus("NONE");
        setFriendshipId(null);
      }
    } catch (err) {
      console.error("Friend action failed:", err);
    } finally {
      setFriendLoading(false);
    }
  }

  async function handleMessage() {
    if (!backendUser || messagingLoading) return;
    if (messagingConversationId) {
      router.push(`/chat/${messagingConversationId}`);
      return;
    }
    setMessagingLoading(true);
    try {
      const token = await getToken();
      const conversation = await startConversation(backendUser.id, token);
      setMessagingConversationId(conversation.id);
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      console.error("Failed to start conversation:", err);
    } finally {
      setMessagingLoading(false);
    }
  }

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (clerkUser && clerkUser.username === username) {
      router.replace("/profile");
    }
  }, [clerkUser, username, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_URL}/users/username/${encodeURIComponent(username)}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {},
        );
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) {
          console.error("Failed to fetch profile:", res.status);
          if (!cancelled) setNotFound(true);
          return;
        }
        const data: BackendUser = await res.json();
        if (!cancelled) {
          setBackendUser(data);
          setProfile(backendUserToProfile(data));
        }
        const [ratings, statusRes, postCountRes] = await Promise.all([
          fetchUserAlbumRatings(username, token).catch(() => []),
          token ? fetchFriendStatus(data.id, token).catch(() => null) : Promise.resolve(null),
          fetch(`${API_URL}/posts/author/${data.id}/count`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (!cancelled) {
          setAlbumsRatedCount(ratings.length);
          if (postCountRes) setPostsCount(postCountRes.count);
          if (statusRes) {
            setFriendStatus(statusRes.status);
            setFriendshipId(statusRes.friendshipId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, getToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-primary text-3xl">
            person
          </span>
        </div>
      </div>
    );
  }

  if (notFound || !backendUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <span className="material-symbols-outlined text-primary text-4xl">
          person_off
        </span>
        <p className="text-on-surface font-bold text-4xl">User not found</p>
        <button
          onClick={() => router.back()}
          className="text-primary font-semibold text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  const displayName =
    profile.displayName || backendUser.displayName || backendUser.username;
  const avatarUrl = backendUser.profileImage || "";
  const memberYear = new Date(backendUser.dateJoined).getFullYear();
  const bannerStyle = bannerBackground(profile.bannerUrl);
  const accentVar = profile.accentColor
    ? ({ "--profile-accent": profile.accentColor } as React.CSSProperties)
    : undefined;
  const accentIsLight = !!profile.accentColor && getContrastColor(profile.accentColor) === "#0d0d0d";
  const statColor = accentIsLight ? "var(--color-primary)" : "var(--profile-accent, var(--color-primary))";
  const tagBg = accentIsLight
    ? "color-mix(in srgb, var(--color-primary) 15%, transparent)"
    : "color-mix(in srgb, var(--profile-accent, var(--color-primary)) 15%, transparent)";

  return (
    <div style={accentVar}>
      {/* Header */}
      <section className="relative">
        {/* Banner */}
        <div
          className="h-48 md:h-64 w-full bg-cover bg-center"
          style={bannerStyle}
        />

        {/* Profile info */}
        <div className="px-6 md:px-12 -mt-16 md:-mt-20 relative z-10">
          <div className="flex flex-col items-center md:flex-row md:items-end gap-6">
            {/* Avatar */}
            <div className="relative w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-2xl overflow-hidden shadow-2xl border-4 border-surface bg-surface-container-high">
              {avatarUrl && !avatarError ? (
                <Image
                  alt={displayName}
                  fill
                  className="object-cover"
                  src={avatarUrl}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl">
                    person
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left pb-2">
              <h1
                className="text-3xl md:text-[3.2rem] font-extrabold tracking-tighter leading-none mb-1"
                style={
                  profile.nameColor ? { color: profile.nameColor } : undefined
                }
              >
                {displayName}
              </h1>
              <p className="text-sm text-on-surface-variant font-medium mb-2">
                @{backendUser.username}
              </p>
              {profile.bio && (
                <p className="text-on-surface-variant text-sm mb-2 max-w-lg">
                  {profile.bio}
                </p>
              )}
              {profile.country && (
                <span className="inline-block text-xs font-semibold bg-surface-container-high px-3 py-1 rounded-full text-on-surface-variant mb-3">
                  {countryFlag(profile.country)} {profile.country}
                </span>
              )}
              {profile.tags && profile.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-3">
                  {profile.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-semibold px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: tagBg,
                        color: statColor,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-6 md:gap-8 text-on-surface-variant font-medium flex-wrap justify-center md:justify-start mt-2">
                <div className="flex items-center gap-2">
                  <span
                    className="font-bold text-4xl"
                    style={{
                      color: statColor,
                    }}
                  >
                    {albumsRatedCount ?? "—"}
                  </span>
                  <span className="text-sm uppercase tracking-wide">
                    Albums Rated
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-bold text-4xl"
                    style={{ color: statColor }}
                  >
                    {postsCount ?? "—"}
                  </span>
                  <span className="text-sm uppercase tracking-wide">
                    Posts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-bold text-4xl"
                    style={{
                      color: statColor,
                    }}
                  >
                    3
                  </span>
                  <span className="text-sm uppercase tracking-wide">
                    Communities
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-bold text-4xl"
                    style={{
                      color: statColor,
                    }}
                  >
                    12
                  </span>
                  <span className="text-sm uppercase tracking-wide">
                    Check-ins
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 shrink-0 mb-2">
              {clerkUser && (
                <button
                  onClick={handleFriend}
                  disabled={friendLoading}
                  className={`px-5 py-2.5 text-sm font-bold rounded-full transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                    friendStatus === "ACCEPTED"
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : friendStatus === "PENDING_SENT"
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-primary text-on-primary hover:opacity-90"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {friendLoading ? "hourglass_empty"
                        : friendStatus === "ACCEPTED" ? "how_to_reg"
                        : friendStatus === "PENDING_SENT" ? "schedule"
                        : friendStatus === "PENDING_RECEIVED" ? "person_add"
                        : "person_add"}
                    </span>
                    {friendLoading ? "..."
                      : friendStatus === "ACCEPTED" ? "Friends"
                      : friendStatus === "PENDING_SENT" ? "Request Sent"
                      : friendStatus === "PENDING_RECEIVED" ? "Accept Request"
                      : "Add Friend"}
                  </span>
                </button>
              )}
              {clerkUser && (
                <button
                  onClick={handleMessage}
                  disabled={messagingLoading}
                  className="px-5 py-2.5 text-sm font-bold rounded-full bg-primary text-on-primary hover:opacity-90 transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 18 }}
                    >
                      {messagingLoading ? "hourglass_empty" : "chat"}
                    </span>
                    {messagingLoading ? "Opening..." : "Message"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <ProfileWidgetGrid profile={profile} username={username} />

      <div className="px-6 md:px-12 py-6 text-center">
        <p className="text-xs text-on-surface-variant/50 font-medium">Member since {memberYear}</p>
      </div>
    </div>
  );
}
