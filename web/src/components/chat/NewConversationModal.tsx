"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Search, X, Loader2 } from "lucide-react";
import Image from "next/image";
import { searchUsers, startConversation } from "@/lib/chat-api";
import { BackendUser } from "@/lib/api";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewConversationModal({ isOpen, onClose }: NewConversationModalProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BackendUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Debounced search could be added here, but simple button trigger or effect is fine too
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setIsSearching(true);
        try {
          const token = await getToken();
          const users = await searchUsers(query.trim(), token);
          setResults(users);
        } catch (e) {
          console.error("Search failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query, getToken]);

  const handleStart = async (targetUserId: string) => {
    try {
      setIsStarting(true);
      const token = await getToken();
      const convo = await startConversation(targetUserId, token);
      
      onClose();
      router.push(`/chat/${convo.id}`);
    } catch (e) {
      console.error("Start conversation failed", e);
    } finally {
      setIsStarting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-lg border border-border flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold">New Message</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by username..."
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {isSearching ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            results.map((u) => (
              <button
                key={u.id}
                onClick={() => handleStart(u.id)}
                disabled={isStarting}
                className="w-full flex items-center gap-3 p-3 text-left rounded-xl hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                {u.profileImage ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <Image src={u.profileImage} alt={u.username} width={40} height={40} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold uppercase flex-shrink-0">
                    {u.username.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm">{u.displayName || u.username}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
              </button>
            ))
          ) : query.length >= 2 ? (
            <div className="text-center p-8 text-muted-foreground text-sm">
              No users found matching &quot;{query}&quot;
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground text-sm">
              Type at least 2 characters to search for users.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
