"use client";

import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { Message } from "@/types/chat";
import { useMessageScroll } from "@/hooks/useMessageScroll";

// ── Component ─────────────────────────────────────────────────────────────────

interface MessageThreadProps {
  messages: Message[];
  conversationId: string;
  hasMore: boolean;
  isLoading?: boolean;
  isLoadingMore: boolean;
  isDecrypting?: boolean;
  onLoadMore: () => void;
  otherLastReadAt?: string | null;
  myLastReadAt?: string | null;
  onRetry?: (msg: Message) => void;
}

export function MessageThread({
  messages,
  conversationId,
  hasMore,
  isLoading,
  isLoadingMore,
  isDecrypting,
  onLoadMore,
  otherLastReadAt,
  myLastReadAt,
  onRetry,
}: MessageThreadProps) {
  const {
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
    formatDayLabel,
  } = useMessageScroll(
    messages,
    conversationId,
    hasMore,
    isLoadingMore,
    onLoadMore,
    otherLastReadAt,
    myLastReadAt
  );

  return (
    <div
      className="flex-1 overflow-y-auto px-4 md:px-6 py-4 custom-scrollbar"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {/* Loading indicator */}
      {isLoadingMore && (
        <div className="sticky top-4 flex justify-center z-10 pointer-events-none">
          <div className="flex items-center gap-2 bg-surface-container shadow-md rounded-full px-4 py-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-on-surface-variant">Loading...</span>
          </div>
        </div>
      )}

      {/* Beginning of conversation */}
      {!hasMore && messages.length > 0 && (
        <div className="flex justify-center py-6">
          <span className="text-[11px] text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
            Beginning of conversation
          </span>
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isLoadingMore && (
        <div className="h-full flex items-center justify-center flex-col text-center space-y-3">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center">
            <span className="text-2xl">👋</span>
          </div>
          <h3 className="text-lg font-semibold">Say hello!</h3>
          <p className="text-sm text-on-surface-variant max-w-[200px]">
            Send a message to start the conversation.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {(isDecrypting || isLoading) && (
        <div className="flex flex-col space-y-3 animate-pulse">
          {[55, 35, 70, 45, 80, 30, 60].map((w, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
              <div
                className={`h-9 rounded-3xl bg-surface-container-high ${i % 2 === 0 ? "rounded-br-sm" : "rounded-bl-sm"}`}
                style={{ width: `${w}%`, maxWidth: "75%" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Message list */}
      <div className={`flex flex-col space-y-1 ${(isDecrypting || isLoading) ? "invisible" : ""}`}>
        {displayMessages.map((msg, idx) => {
          const isMine = msg.senderId === backendUserId;
          const showTime = isLastInGroup(idx);
          const showDateSeparator = shouldShowDateSeparator(idx);

          return (
            <div key={msg.id || msg.tempId}>
              {/* New messages separator */}
              {idx === newMessagesStartIdx && (
                <div ref={newMessagesSeparatorRef} className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-primary/25" />
                  <span className="text-[11px] font-semibold text-primary shrink-0">New messages</span>
                  <div className="flex-1 h-px bg-primary/25" />
                </div>
              )}

              {/* Date separator */}
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <span className="text-[11px] text-on-surface-variant font-medium bg-surface-container px-3 py-1 rounded-full">
                    {formatDayLabel(msg.createdAt)}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <MessageBubble
                message={msg}
                isMine={isMine}
                showTime={showTime}
                isLastInGroup={isLastInGroup(idx)}
                onRetry={msg.status === "failed" && onRetry ? () => onRetry(msg) : undefined}
              />

              {/* Seen indicator */}
              {idx === lastSeenIdx && (
                <p className="text-[11px] text-on-surface-variant text-right pr-1 -mt-2 mb-2">
                  Seen
                </p>
              )}
            </div>
          );
        })}

        {/* Typing indicators */}
        {typistList.map((username) => (
          <div key={username} className="mb-4">
            <TypingIndicator username={username} />
          </div>
        ))}

        {/* Bottom anchor */}
        <div ref={bottomRef} className="h-1 w-full" />
      </div>
    </div>
  );
}

MessageThread.displayName = "MessageThread";
