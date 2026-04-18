"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Message } from "@/types/chat";
import { chatWs } from "@/lib/ws";
import { useUserStore } from "@/store/userStore";

// ── Helper functions (module scope) ────────────────────────────────────────────

function dayKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDay(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(ts) === dayKey(now.toISOString())) return "Today";
  if (dayKey(ts) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function minuteBucket(ts: string): number {
  return Math.floor(new Date(ts).getTime() / 60000);
}

// ── Hook return type ───────────────────────────────────────────────────────────

interface UseMessageScrollReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  newMessagesSeparatorRef: React.RefObject<HTMLDivElement | null>;
  displayMessages: Message[];
  typistList: string[];
  newMessagesStartIdx: number;
  lastSeenIdx: number;
  backendUserId: string | null;
  handleScroll: () => void;
  shouldShowDateSeparator: (idx: number) => boolean;
  isLastInGroup: (idx: number) => boolean;
  formatDayLabel: (ts: string) => string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMessageScroll(
  messages: Message[],
  conversationId: string,
  hasMore: boolean,
  isLoadingMore: boolean,
  onLoadMore: () => void,
  otherLastReadAt: string | null | undefined,
  myLastReadAt: string | null | undefined
): UseMessageScrollReturn {
  const { backendUserId, backendUsername } = useUserStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const [typists, setTypists] = useState<Map<string, string>>(new Map());
  const newMessagesSeparatorRef = useRef<HTMLDivElement>(null);
  const hasScrolledToNewRef = useRef(false);

  // Typing events subscription
  useEffect(() => {
    const unsubs = [
      chatWs.on("TYPING", (payload: { conversationId: string; userId: string; username: string; isTyping: boolean }) => {
        if (payload.conversationId === conversationId && payload.username !== backendUsername) {
          setTypists(prev => {
            const next = new Map(prev);
            if (payload.isTyping) {
              next.set(payload.userId, payload.username);
            } else {
              next.delete(payload.userId);
            }
            return next;
          });
        }
      })
    ];
    return () => unsubs.forEach(u => u());
  }, [conversationId, backendUserId, backendUsername]);

  // Scroll to bottom on new messages
  const newestMessageId = messages[0]?.id;
  useEffect(() => {
    if (!bottomRef.current) return;
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    });
    return () => cancelAnimationFrame(id);
  }, [newestMessageId, typists.size]);

  // Restore scroll position after loading more
  useEffect(() => {
    if (!isLoadingMore && containerRef.current && prevScrollHeightRef.current > 0) {
      const newScrollHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [isLoadingMore]);

  // Scroll to "new messages" separator on initial load
  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);
  const newMessagesStartIdx = useMemo(() => {
    if (!myLastReadAt) return -1;
    const cutoff = new Date(myLastReadAt).getTime();
    return displayMessages.findIndex(
      (msg) => msg.senderId !== backendUserId && new Date(msg.createdAt).getTime() > cutoff
    );
  }, [displayMessages, myLastReadAt, backendUserId]);

  useEffect(() => {
    if (hasScrolledToNewRef.current || newMessagesStartIdx === -1 || !newMessagesSeparatorRef.current) return;
    hasScrolledToNewRef.current = true;
    const id = requestAnimationFrame(() => {
      newMessagesSeparatorRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [newMessagesStartIdx]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop } = containerRef.current;
    if (scrollTop < 100 && hasMore && !isLoadingMore) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Last seen index calculation
  const lastSeenIdx = useMemo(() => {
    if (!otherLastReadAt) return -1;
    return displayMessages.reduce((found, msg, idx) => {
      if (
        msg.senderId === backendUserId &&
        msg.status !== "sending" &&
        new Date(otherLastReadAt) >= new Date(msg.createdAt)
      ) {
        return idx;
      }
      return found;
    }, -1);
  }, [displayMessages, otherLastReadAt, backendUserId]);

  const typistList = useMemo(() => Array.from(typists.values()), [typists]);

  // Helper for checking if a message is last in its group
  const isLastInGroup = useCallback((idx: number): boolean => {
    const msg = displayMessages[idx];
    const next = displayMessages[idx + 1];
    return (
      !next ||
      next.senderUsername !== msg.senderUsername ||
      minuteBucket(next.createdAt) !== minuteBucket(msg.createdAt)
    );
  }, [displayMessages]);

  // Helper for showing date separator
  const shouldShowDateSeparator = useCallback((idx: number): boolean => {
    if (idx === 0) return true;
    const prev = displayMessages[idx - 1];
    const msg = displayMessages[idx];
    return dayKey(prev.createdAt) !== dayKey(msg.createdAt);
  }, [displayMessages]);

  return {
    containerRef,
    bottomRef,
    newMessagesSeparatorRef,
    displayMessages,
    typistList,
    newMessagesStartIdx,
    lastSeenIdx,
    backendUserId,
    handleScroll,
    shouldShowDateSeparator,
    isLastInGroup,
    formatDayLabel: formatDay,
  };
}
