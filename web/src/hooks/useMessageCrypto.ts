"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Message } from "@/types/chat";
import { isEncrypted } from "@/lib/crypto";

type CryptFn = (content: string) => Promise<string>;

// ── Hook return type ───────────────────────────────────────────────────────────

interface UseMessageCryptoReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  decryptBatch: (msgs: Message[]) => Promise<Message[]>;
  decryptSingle: (msg: Message) => Promise<Message>;
  isDecrypting: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMessageCrypto(
  initialMessages: Message[] = [],
  decryptFn?: CryptFn
): UseMessageCryptoReturn {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const decryptFnRef = useRef(decryptFn);

  // Keep ref updated for non-reactive access
  useEffect(() => {
    decryptFnRef.current = decryptFn;
  }, [decryptFn]);

  /**
   * Decrypts a single message if encrypted
   */
  const decryptSingle = useCallback(async (msg: Message): Promise<Message> => {
    const fn = decryptFnRef.current;
    if (!fn || !isEncrypted(msg.content)) {
      return msg;
    }
    const content = await fn(msg.content).catch(
      () => "[Encrypted message — decryption failed]"
    );
    return { ...msg, content };
  }, []);

  /**
   * Decrypts a batch of messages
   */
  const decryptBatch = useCallback(async (msgs: Message[]): Promise<Message[]> => {
    const fn = decryptFnRef.current;
    if (!fn) return msgs;
    return Promise.all(
      msgs.map(async (m) => {
        if (!isEncrypted(m.content)) return m;
        const content = await fn(m.content).catch(
          () => "[Encrypted message — decryption failed]"
        );
        return { ...m, content };
      })
    );
  }, []);

  // Auto-decrypt messages when decryptFn becomes available
  useEffect(() => {
    if (!decryptFn) return;

    const snapshot = messages;
    const hasEncrypted = snapshot.some((m) => isEncrypted(m.content));
    if (!hasEncrypted) return;

    let isMounted = true;
    Promise.all(
      snapshot.map(async (m) => {
        if (!isEncrypted(m.content)) return m;
        const content = await decryptFn(m.content).catch(
          () => "[Encrypted message — decryption failed]"
        );
        return { ...m, content };
      })
    ).then((decrypted) => {
      if (isMounted) setMessages(decrypted);
    });

    return () => {
      isMounted = false;
    };
  }, [decryptFn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed state
  const isDecrypting =
    messages.length > 0 && messages.some((m) => isEncrypted(m.content));

  return {
    messages,
    setMessages,
    decryptBatch,
    decryptSingle,
    isDecrypting,
  };
}
