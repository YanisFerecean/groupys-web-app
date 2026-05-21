"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Message } from "@/types/chat";
import { fetchMessages, postMessage, ApiError } from "@/lib/chat-api";
import { chatWs } from "@/lib/ws";
import { useAuth } from "@clerk/nextjs";
import { isEncrypted } from "@/lib/crypto";
import { useMessageCrypto } from "./useMessageCrypto";

const MAX_MESSAGES = 300;

type CryptFn = (content: string) => Promise<string>;

export function useMessages(
  conversationId: string | null,
  decryptFn?: CryptFn,
  encryptFn?: CryptFn
) {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [rateLimitError, setRateLimitError] = useState(false);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use extracted crypto hook
  const { messages, setMessages, decryptBatch, isDecrypting } = useMessageCrypto([], decryptFn);

  // Encrypt function ref
  const encryptFnRef = useRef(encryptFn);
  useEffect(() => {
    encryptFnRef.current = encryptFn;
  }, [encryptFn]);

  // Initial load
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const token = await getToken();
        const msgs = await fetchMessages(conversationId!, 0, 30, token);
        const decrypted = await decryptBatch(msgs);
        if (isMounted) {
          setMessages(decrypted);
          setHasMore(msgs.length === 30);
        }
      } catch (err) {
        console.error("Failed to load msgs:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [conversationId, getToken, decryptBatch, setMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    const unsubs = [
      chatWs.on("MESSAGE_NEW", async (payload: Message) => {
        if (payload.conversationId !== conversationId) return;

        // Decrypt incoming message
        let content = payload.content;
        const fn = decryptFn;
        if (fn && isEncrypted(content)) {
          content = await fn(content).catch(
            () => "[Encrypted message — decryption failed]"
          );
        }
        const msg = { ...payload, content };

        setMessages((prev) => {
          if (payload.tempId) {
            const idx = prev.findIndex((m) => m.tempId === payload.tempId);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...msg, status: "sent" };
              return updated;
            }
          }
          if (prev.some((m) => m.id === payload.id)) return prev;
          const next = [msg, ...prev];
          return next.length > MAX_MESSAGES ? next.slice(0, MAX_MESSAGES) : next;
        });
      }),

      chatWs.on("MESSAGE_ACK", (payload: { tempId: string; messageId: string; createdAt: string }) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.tempId === payload.tempId);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              id: payload.messageId,
              createdAt: payload.createdAt,
              status: "sent",
            };
            return updated;
          }
          return prev;
        });
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [conversationId, decryptFn, setMessages]);

  const loadMore = useCallback(
    async (page: number) => {
      if (!conversationId || isLoading || !hasMore) return;
      setIsLoading(true);
      try {
        const token = await getToken();
        const msgs = await fetchMessages(conversationId, page, 30, token);
        if (msgs.length < 30) setHasMore(false);

        const decrypted = await decryptBatch(msgs);

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = decrypted.filter((m) => !existingIds.has(m.id));
          const combined = [...prev, ...fresh];
          return combined.length > MAX_MESSAGES
            ? combined.slice(0, MAX_MESSAGES)
            : combined;
        });
      } catch (e) {
        console.error("loadMore failed", e);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, hasMore, getToken, decryptBatch, setMessages]
  );

  const sendMessage = useCallback(
    async (content: string, senderId: string, senderUsername: string) => {
      if (!conversationId) return;

      const tempId = Math.random().toString(36).substring(7);
      const tempMsg: Message = {
        id: `temp-${tempId}`,
        conversationId,
        senderId,
        senderUsername,
        senderDisplayName: null,
        senderProfileImage: null,
        content,
        messageType: "text",
        isDeleted: false,
        replyToId: null,
        createdAt: new Date().toISOString(),
        tempId,
        status: "sending",
      };

      setMessages((prev) => [tempMsg, ...prev]);

      try {
        const token = await getToken();
        const toSend = encryptFn ? await encryptFn(content) : content;
        const saved = await postMessage(conversationId, toSend, token);
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.tempId === tempId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...saved, status: "sent", content };
          return updated;
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
          setRateLimitError(true);
          rateLimitTimerRef.current = setTimeout(() => setRateLimitError(false), 4000);
          setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
        } else {
          console.error("Failed to send message:", err);
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.tempId === tempId);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], status: "failed" };
            return updated;
          });
        }
      }
    },
    [conversationId, getToken, encryptFn, setMessages]
  );

  const resendMessage = useCallback(
    async (tempId: string, content: string) => {
      if (!conversationId) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.tempId === tempId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], status: "sending" };
        return updated;
      });
      try {
        const token = await getToken();
        const toSend = encryptFn ? await encryptFn(content) : content;
        const saved = await postMessage(conversationId, toSend, token);
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.tempId === tempId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...saved, status: "sent", content };
          return updated;
        });
      } catch {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.tempId === tempId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: "failed" };
          return updated;
        });
      }
    },
    [conversationId, getToken, encryptFn, setMessages]
  );

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
    resendMessage,
    rateLimitError,
    isDecrypting,
  };
}
