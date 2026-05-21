"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  fetchCurrentHotTake,
  fetchMyHotTakeAnswer,
  fetchUserHotTakeAnswer,
  type HotTakeAnswerRes,
  type HotTakeRes,
} from "@/lib/hot-take-api";
import { getContrastColor } from "@/lib/utils";
import WidgetCard from "./WidgetCard";
import HotTakeAnswerModal from "@/components/feed/HotTakeAnswerModal";

interface HotTakeWidgetProps {
  username: string;
  containerColor?: string;
  size?: "small" | "normal";
}

export default function HotTakeWidget({ username, containerColor, size = "normal" }: HotTakeWidgetProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const [hotTake, setHotTake] = useState<HotTakeRes | null>(null);
  const [answer, setAnswer] = useState<HotTakeAnswerRes | null>(null);
  const [myAnswer, setMyAnswer] = useState<HotTakeAnswerRes | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const currentUsername = user?.username;

  const textColor = containerColor ? getContrastColor(containerColor) : undefined;
  const isOwnProfile = currentUsername === username;
  const shouldBlur = !isOwnProfile && myAnswer === null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const [ht, ans, mine] = await Promise.all([
          fetchCurrentHotTake(),
          fetchUserHotTakeAnswer(username, token),
          fetchMyHotTakeAnswer(token),
        ]);
        if (!cancelled) {
          setHotTake(ht);
          setAnswer(ans);
          setMyAnswer(mine);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  const title = hotTake?.weekLabel
    ? `Hot Take · ${hotTake.weekLabel}`
    : "Hot Take";

  const picks = answer?.answers ?? [];

  function iconForType(type: string) {
    if (type === "SONG" || type === "track") return "music_note";
    if (type === "ALBUM" || type === "album") return "album";
    if (type === "COMMUNITY") return "group";
    return "person";
  }

  return (
    <>
      <div
        className="relative"
        onClick={shouldBlur && hotTake ? () => setModalOpen(true) : undefined}
        style={shouldBlur && hotTake ? { cursor: "pointer" } : undefined}
      >
        {shouldBlur && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-2xl backdrop-blur-md bg-surface/30">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 22, color: "var(--color-on-surface-variant)", fontVariationSettings: "'FILL' 1" }}
            >
              lock
            </span>
            <p className="text-xs font-medium text-center px-2 leading-snug" style={{ color: "var(--color-on-surface-variant)" }}>
              Answer to reveal
            </p>
          </div>
        )}
        <WidgetCard
          title={title}
          className="h-[260px] flex flex-col overflow-hidden"
          style={containerColor ? { backgroundColor: containerColor } : undefined}
          textColor={textColor}
        >
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-outline border-t-primary animate-spin" />
            </div>
          ) : !hotTake ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 28, color: textColor ?? "var(--color-on-surface-variant)", opacity: 0.35, fontVariationSettings: "'FILL' 1" }}
              >
                local_fire_department
              </span>
              <p className="text-xs" style={{ color: textColor ?? "var(--color-on-surface-variant)", opacity: 0.5 }}>
                No hot take this week
              </p>
            </div>
          ) : !answer ? (
            <div className="flex-1 flex flex-col gap-3">
              <p
                className="text-sm font-bold leading-snug"
                style={textColor ? { color: textColor } : { color: "var(--color-on-surface)" }}
              >
                {hotTake.question}
              </p>
              {isOwnProfile ? (
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                  Answer now
                </button>
              ) : (
                <p className="text-xs italic" style={{ color: textColor ?? "var(--color-on-surface-variant)", opacity: 0.45 }}>
                  No answer yet
                </p>
              )}
            </div>
          ) : size === "small" ? (
            /* ── Small: first pick image + answer text ── */
            <div className="flex-1 flex flex-col items-center gap-3 min-h-0">
              <div className="relative flex-1 w-full min-h-0 rounded-xl overflow-hidden shadow-md">
                {answer!.imageUrls[0] ? (
                  <Image
                    src={answer!.imageUrls[0]!}
                    alt={picks[0]}
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 768px) 25vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 48, fontVariationSettings: "'FILL' 1" }}>
                      local_fire_department
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs font-bold truncate w-full text-center shrink-0" style={{ color: textColor ?? "inherit" }}>
                {picks[0]}{picks.length > 1 ? ` +${picks.length - 1}` : ""}
              </p>
            </div>
          ) : (
            /* ── Normal: bigger question + adaptive picks layout ── */
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <p
                className="text-sm font-bold leading-snug shrink-0"
                style={textColor ? { color: textColor } : { color: "var(--color-on-surface)" }}
              >
                {hotTake!.question}
              </p>

              {/* All answer counts: square image left, text right */}
              {(() => {
                const imgSize = picks.length === 1 ? "w-14 h-14" : picks.length <= 3 ? "w-11 h-11" : "w-9 h-9";
                const imgPx = picks.length === 1 ? 56 : picks.length <= 3 ? 44 : 36;
                const textSize = picks.length === 1 ? "text-sm font-bold" : picks.length <= 3 ? "text-xs font-bold" : "text-[11px] font-semibold";
                return (
                  <div className="flex-1 flex flex-col justify-between min-h-0">
                    {picks.map((pick, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`relative ${imgSize} rounded-xl overflow-hidden shrink-0 shadow-sm`}>
                          {answer!.imageUrls[i] ? (
                            <Image
                              src={answer!.imageUrls[i]!}
                              alt={pick}
                              fill
                              sizes={`${imgPx}px`}
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                              <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: imgPx * 0.45, fontVariationSettings: "'FILL' 1" }}>
                                {iconForType(answer!.musicTypes[i] ?? "")}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className={`${textSize} leading-snug line-clamp-2 min-w-0`} style={{ color: textColor ?? "inherit" }}>
                          {pick}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </WidgetCard>
      </div>

      {hotTake && (
        <HotTakeAnswerModal
          open={modalOpen}
          hotTake={hotTake}
          onClose={() => setModalOpen(false)}
          onAnswered={async () => {
            setModalOpen(false);
            const token = await getTokenRef.current();
            const mine = await fetchMyHotTakeAnswer(token);
            setMyAnswer(mine);
            if (isOwnProfile) setAnswer(mine);
          }}
        />
      )}
    </>
  );
}
