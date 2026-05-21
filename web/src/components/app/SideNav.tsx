"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useHotTakeStore } from "@/store/hotTakeStore";
import FriendsSheet from "@/components/friends/FriendsSheet";
import { MessageCircle, Settings } from "lucide-react";
import { useConversationStore } from "@/store/conversationStore";

const navItems = [
  { label: "Feed", icon: "rss_feed", href: "/feed" },
  { label: "Discover", icon: "explore", href: "/discover" },
  { label: "Mutuals", icon: "favorite", href: "/match" },
  { label: "Profile", icon: "person_outline", href: "/profile" },
];

interface SideNavProps {
  open?: boolean;
  onClose?: () => void;
  onSettingsClick?: () => void;
  onCreatePost?: () => void;
}

export default function SideNav({ open, onClose, onSettingsClick, onCreatePost }: SideNavProps) {
  const pathname = usePathname();
  const hasUnansweredHotTake = useHotTakeStore((s) => s.hasUnanswered);
  const hasMessageNotification = useConversationStore((s) =>
    s.conversations.some((c) => c.unreadCount > 0 || c.requestStatus === "PENDING_INCOMING")
  );

  return (
    <>
      {/* Backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "h-screen w-64 fixed left-0 top-0 bg-surface border-r border-surface-container z-50 flex flex-col transition-transform duration-300",
          "max-lg:-translate-x-full max-lg:data-[open=true]:translate-x-0",
          "lg:translate-x-0",
        )}
        data-open={open}
      >
        <div className="flex flex-col h-full p-6">
          <Link
            href="/"
            className="text-3xl font-extrabold tracking-tighter text-primary mb-8 block"
          >
            Groupys
          </Link>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={
                    active
                      ? "flex items-center gap-3 px-6 py-3 text-primary font-bold bg-primary/5 rounded-xl"
                      : "flex items-center gap-3 px-6 py-3 text-slate-500 font-medium hover:bg-surface-container rounded-xl transition-colors"
                  }
                >
                  <span className="relative">
                    <span className="material-symbols-outlined">
                      {item.icon}
                    </span>
                    {item.href === "/feed" && hasUnansweredHotTake && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-surface" />
                    )}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => { onClose?.(); onCreatePost?.(); }}
              className="flex items-center gap-3 px-6 py-3 mt-1 w-full text-on-primary font-bold bg-primary hover:opacity-90 active:scale-95 rounded-xl transition-all"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Create Post</span>
            </button>
          </nav>

          <div className="mt-auto pt-8">
            <div className="flex flex-col gap-1">
              <FriendsSheet>
                {(pendingCount) => (
                  <button className="flex items-center gap-3 px-6 py-3 w-full text-slate-500 font-medium hover:bg-surface-container rounded-xl transition-colors">
                    <span className="relative">
                      <span className="material-symbols-outlined">group</span>
                      {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-surface" />
                      )}
                    </span>
                    <span>Friends</span>
                  </button>
                )}
              </FriendsSheet>
              <Link
                href="/chat"
                onClick={onClose}
                className="flex items-center gap-3 px-6 py-3 text-slate-500 font-medium hover:bg-surface-container rounded-xl transition-colors"
              >
                <span className="relative">
                  <MessageCircle className="w-6 h-6" />
                  {hasMessageNotification && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-surface" />
                  )}
                </span>
                <span>Messages</span>
              </Link>
              <button
                onClick={() => { onClose?.(); onSettingsClick?.(); }}
                className="flex items-center gap-3 px-6 py-3 w-full text-slate-500 font-medium hover:bg-surface-container rounded-xl transition-colors"
              >
                <Settings className="w-6 h-6" />
                <span>Settings</span>
              </button>
            </div>
            <div className="bg-surface-container h-px mb-6 mt-2" />
            <div className="flex flex-col gap-1 mb-6">
              <Link href="/privacy" onClick={onClose} className="px-6 py-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors rounded-lg hover:bg-surface-container">
                Privacy Policy
              </Link>
              <Link href="/terms" onClick={onClose} className="px-6 py-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors rounded-lg hover:bg-surface-container">
                Terms of Use
              </Link>
              <Link href="/impressum" onClick={onClose} className="px-6 py-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors rounded-lg hover:bg-surface-container">
                Legal Notice
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
