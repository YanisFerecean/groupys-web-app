"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProfileCustomization } from "@/types/profile";
import { countryFlag } from "@/lib/countries";
import { getContrastColor } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

interface ProfileHeaderProps {
  profile: ProfileCustomization;
  avatarUrl: string;
  clerkName: string;
  username: string;
  albumsRatedCount?: number | null;
  onEditClick: () => void;
}

const DEFAULT_BANNER =
  "linear-gradient(135deg, #1a1c1d 0%, #2f3132 40%, #5d3f3f 100%)";

function bannerBackground(value?: string): React.CSSProperties {
  if (!value) return { backgroundImage: DEFAULT_BANNER };
  if (value.startsWith("linear-gradient") || value.startsWith("radial-gradient")) {
    return { backgroundImage: value };
  }
  const url = value.startsWith("/") ? `${API_URL.replace(/\/api$/, "")}${value}` : value;
  return { backgroundImage: `url(${url})` };
}

export default function ProfileHeader({
  profile,
  avatarUrl,
  clerkName,
  username,
  albumsRatedCount,
  onEditClick,
}: ProfileHeaderProps) {
  const [avatarError, setAvatarError] = useState(false);
  const displayName = profile.displayName || clerkName;
  const bannerStyle = bannerBackground(profile.bannerUrl);
  // Accent used as text on the page surface — fall back to primary when the accent is too light to read
  const accentIsLight = !!profile.accentColor && getContrastColor(profile.accentColor) === "#0d0d0d";
  const statColor = accentIsLight
    ? "var(--color-primary)"
    : "var(--profile-accent, var(--color-primary))";

  return (
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
            {avatarError ? (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl">person</span>
              </div>
            ) : (
              <Image
                alt={displayName}
                fill
                className="object-cover"
                src={avatarUrl}
                onError={() => setAvatarError(true)}
              />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left pb-2">
            <h1
              className="text-3xl md:text-[3.2rem] font-extrabold tracking-tighter leading-none mb-1"
              style={profile.nameColor ? { color: profile.nameColor } : undefined}
            >
              {displayName}
            </h1>
            {username && (
              <p className="text-sm text-on-surface-variant font-medium mb-2">
                @{username}
              </p>
            )}
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
                      backgroundColor: "color-mix(in srgb, var(--profile-accent, var(--color-primary)) 15%, transparent)",
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
                <span className="font-bold text-lg" style={{ color: statColor }}>{albumsRatedCount ?? "—"}</span>
                <span className="text-sm uppercase tracking-wide">Albums Rated</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg" style={{ color: statColor }}>3</span>
                <span className="text-sm uppercase tracking-wide">Communities</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg" style={{ color: statColor }}>12</span>
                <span className="text-sm uppercase tracking-wide">Check-ins</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0 mb-2">
            <button
              onClick={onEditClick}
              className="px-5 py-2.5 text-sm font-bold rounded-full transition-colors"
              style={{
                backgroundColor: "var(--profile-accent, var(--color-primary))",
                color: profile.accentColor ? getContrastColor(profile.accentColor) : "#fff",
              }}
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
