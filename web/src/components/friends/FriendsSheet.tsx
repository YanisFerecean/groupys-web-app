"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  fetchFriends,
  fetchReceivedRequests,
  fetchSentRequests,
  acceptFriendRequest,
  declineOrCancelRequest,
  removeFriend,
  type FriendRes,
} from "@/lib/friends-api";

// ── Shared avatar ─────────────────────────────────────────────────────────────

function Avatar({ user }: { user: FriendRes }) {
  return user.profileImage ? (
    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
      <Image
        src={user.profileImage}
        alt={user.displayName || user.username}
        width={40}
        height={40}
        className="object-cover w-full h-full"
      />
    </div>
  ) : (
    <div className="w-10 h-10 shrink-0 rounded-full bg-surface-container-high flex items-center justify-center">
      <span className="material-symbols-outlined text-on-surface-variant/40 text-sm">person</span>
    </div>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: FriendRes;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex items-center gap-3 bg-surface-container-lowest/65 border border-white/80 rounded-2xl px-4 py-3 shadow-sm">
      <Link href={`/profile/${request.username}`}>
        <Avatar user={request} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${request.username}`}
          className="text-sm font-semibold text-on-surface hover:text-primary transition-colors truncate block"
        >
          {request.displayName || request.username}
        </Link>
        <p className="text-xs text-on-surface-variant truncate">@{request.username}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={async () => { setLoading(true); await onAccept(request.friendshipId); setLoading(false); }}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-bold rounded-full bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "…" : "Accept"}
        </button>
        <button
          onClick={async () => { setLoading(true); await onDecline(request.friendshipId); setLoading(false); }}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-bold rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

// ── Friend card ───────────────────────────────────────────────────────────────

function FriendCard({
  friend,
  onRemove,
}: {
  friend: FriendRes;
  onRemove: (userId: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  return (
    <div className="flex items-center gap-3 bg-surface-container-lowest/65 border border-white/80 rounded-2xl px-4 py-3 shadow-sm">
      <Link href={`/profile/${friend.username}`}>
        <Avatar user={friend} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${friend.username}`}
          className="text-sm font-semibold text-on-surface hover:text-primary transition-colors truncate block"
        >
          {friend.displayName || friend.username}
        </Link>
        <p className="text-xs text-on-surface-variant truncate">@{friend.username}</p>
      </div>
      <button
        onClick={async () => { setRemoving(true); await onRemove(friend.userId); setRemoving(false); }}
        disabled={removing}
        className="p-2 rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50 shrink-0"
        aria-label="Remove friend"
      >
        <span className="material-symbols-outlined text-base">
          {removing ? "hourglass_empty" : "person_remove"}
        </span>
      </button>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50">{title}</p>
      {count > 0 && (
        <span className="text-xs font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FriendsSheet({ children }: { children?: ((pendingCount: number) => React.ReactNode) | React.ReactNode }) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<FriendRes[]>([]);
  const [received, setReceived] = useState<FriendRes[]>([]);
  const [sent, setSent] = useState<FriendRes[]>([]);

  // Fetch pending count on mount so the trigger badge is visible before opening
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const r = await fetchReceivedRequests(token);
        if (!cancelled) setReceived(r);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  // Load full data when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const [f, r, s] = await Promise.all([
          fetchFriends(token),
          fetchReceivedRequests(token),
          fetchSentRequests(token),
        ]);
        if (!cancelled) { setFriends(f); setReceived(r); setSent(s); }
      } catch (err) {
        console.error("Failed to load friends:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, getToken]);

  const handleAccept = useCallback(async (friendshipId: string) => {
    const token = await getToken();
    const updated = await acceptFriendRequest(friendshipId, token);
    setReceived((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
    setFriends((prev) => [...prev, { ...updated, status: "ACCEPTED" }]);
  }, [getToken]);

  const handleDecline = useCallback(async (friendshipId: string) => {
    const token = await getToken();
    await declineOrCancelRequest(friendshipId, token);
    setReceived((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
  }, [getToken]);

  const handleCancel = useCallback(async (friendshipId: string) => {
    const token = await getToken();
    await declineOrCancelRequest(friendshipId, token);
    setSent((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
  }, [getToken]);

  const handleRemove = useCallback(async (userId: string) => {
    const token = await getToken();
    await removeFriend(userId, token);
    setFriends((prev) => prev.filter((f) => f.userId !== userId));
  }, [getToken]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {typeof children === "function" ? children(received.length) : (children ?? (
          <button
            className="relative w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 transition-colors"
            aria-label="Friends"
          >
            <Users className="w-5 h-5" />
            {received.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold bg-primary text-white rounded-full flex items-center justify-center">
                {received.length > 9 ? "9+" : received.length}
              </span>
            )}
          </button>
        ))}
      </DialogTrigger>

      <DialogContent className="max-w-md bg-surface border-surface-container p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-surface-container">
          <DialogTitle className="text-lg font-bold text-on-surface">Friends</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 rounded-full bg-surface-container-high animate-pulse flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">group</span>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[60vh] px-6 py-5 space-y-6">
            {/* Incoming requests — shown first */}
            {received.length > 0 && (
              <div>
                <SectionLabel title="Friend Requests" count={received.length} />
                <div className="space-y-2">
                  {received.map((r) => (
                    <RequestCard
                      key={r.friendshipId}
                      request={r}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div>
              <SectionLabel title="Friends" count={friends.length} />
              {friends.length === 0 ? (
                <p className="text-sm text-on-surface-variant/50 text-center py-6">
                  No friends yet. Visit someone&apos;s profile to add them.
                </p>
              ) : (
                <div className="space-y-2">
                  {friends.map((f) => (
                    <FriendCard key={f.friendshipId} friend={f} onRemove={handleRemove} />
                  ))}
                </div>
              )}
            </div>

            {/* Sent requests — subtle, at the bottom */}
            {sent.length > 0 && (
              <div>
                <SectionLabel title="Sent Requests" count={sent.length} />
                <div className="space-y-2">
                  {sent.map((r) => (
                    <div
                      key={r.friendshipId}
                      className="flex items-center gap-3 bg-surface-container-lowest/65 border border-white/80 rounded-2xl px-4 py-3 shadow-sm"
                    >
                      <Link href={`/profile/${r.username}`}>
                        <Avatar user={r} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/profile/${r.username}`}
                          className="text-sm font-semibold text-on-surface hover:text-primary transition-colors truncate block"
                        >
                          {r.displayName || r.username}
                        </Link>
                        <p className="text-xs text-on-surface-variant truncate">@{r.username}</p>
                      </div>
                      <button
                        onClick={() => handleCancel(r.friendshipId)}
                        className="px-3 py-1.5 text-xs font-bold rounded-full border border-on-surface-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
