"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { SendHorizonal, Smile } from "lucide-react";
import { chatWs } from "@/lib/ws";

const EmojiPicker = dynamic(() => import("./EmojiPicker"), { ssr: false });

interface MessageInputProps {
  conversationId: string;
  onSend: (content: string) => void;
  disabled?: boolean;
  rateLimitError?: boolean;
}

export function MessageInput({ conversationId, onSend, disabled, rateLimitError }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Close picker on outside click
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  const insertEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + emoji);
      return;
    }
    // Read from el.value (live DOM) rather than closing over `content`,
    // so this function can have a stable empty dep array.
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + emoji + el.value.slice(end);
    setContent(next);
    // Restore cursor after the inserted emoji
    requestAnimationFrame(() => {
      el.selectionStart = start + emoji.length;
      el.selectionEnd = start + emoji.length;
      el.focus();
    });
  }, []);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [content]);

  const stopTyping = () => {
    if (isTyping) {
      chatWs.send({ type: "TYPING_STOP", conversationId });
      setIsTyping(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Typing indicator logic
    if (!isTyping) {
      chatWs.send({ type: "TYPING_START", conversationId });
      setIsTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(stopTyping, 2000);
  };

  const MAX_LENGTH = 2000;
  const remaining = MAX_LENGTH - content.length;
  const nearLimit = remaining <= 200;

  const handleSend = () => {
    if (!content.trim() || disabled || content.length > MAX_LENGTH) return;
    
    stopTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    onSend(content.trim());
    setContent("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-surface border-t border-surface-container-high">
      {rateLimitError && (
        <p className="text-xs text-center text-amber-600 dark:text-amber-400 font-medium mb-2">
          Slow down! You&apos;re sending messages too fast.
        </p>
      )}
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        <div ref={emojiRef} className={`flex-1 relative flex items-center bg-surface-container rounded-full px-4 py-1 gap-1 transition-all ${
          remaining < 0 ? "ring-2 ring-error/30" : "focus-within:ring-2 focus-within:ring-primary/20"
        }`}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={disabled}
            rows={1}
            maxLength={MAX_LENGTH}
            className="flex-1 max-h-30 min-h-11 bg-transparent resize-none text-[15px] text-on-surface focus:outline-none placeholder:text-on-surface-variant disabled:opacity-50 custom-scrollbar py-2.5"
          />
          {nearLimit && (
            <span className={`text-[11px] tabular-nums pointer-events-none flex-shrink-0 ${
              remaining <= 0 ? "text-error font-medium" : "text-on-surface-variant"
            }`}>
              {remaining}
            </span>
          )}
          <button
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            disabled={disabled}
            className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              emojiOpen
                ? "bg-primary/15 text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Smile className="w-5 h-5" />
          </button>
          {emojiOpen && <EmojiPicker onSelectAction={insertEmoji} />}
        </div>
        <button
          onClick={handleSend}
          disabled={!content.trim() || disabled || remaining < 0}
          className="h-11 w-11 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          <SendHorizonal className="w-5 h-5 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
