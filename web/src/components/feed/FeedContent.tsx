"use client";

import HotTakeCard from "./HotTakeCard";
import { FeedPostCard, PostRes } from "./FeedPostCard";
import { useFeed, usePrefetchFeed } from "@/hooks/useFeed";
import { useFeedScroll } from "@/hooks/useFeedScroll";

// ── Main component ───────────────────────────────────────────────────────────

export default function FeedContent() {
  const { posts, isLoading, isLoadingMore, hasMore, loadMore, handleReact, error } = useFeed();
  const { prefetchNextPage } = usePrefetchFeed();
  
  const { handleLoadMore } = useFeedScroll(
    hasMore,
    isLoadingMore,
    loadMore,
    prefetchNextPage
  );

  if (error) {
    return (
      <section className="w-full max-w-4xl px-6 lg:px-12 py-8 lg:py-12">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="material-symbols-outlined text-error text-5xl">error</span>
          <p className="text-on-surface font-bold text-lg">Failed to load feed</p>
          <p className="text-on-surface-variant text-sm text-center max-w-xs">
            Please try refreshing the page
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-4xl px-6 lg:px-12 py-8 lg:py-12">
      <header className="mb-10">
        <h2 className="text-display-lg mb-1 text-primary">Your Feed</h2>
        <p className="text-on-surface-variant text-sm">
          Latest posts from your communities
        </p>
      </header>

      <HotTakeCard />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-primary text-2xl">
              dynamic_feed
            </span>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl">
            group
          </span>
          <p className="text-on-surface font-bold text-lg">No posts yet</p>
          <p className="text-on-surface-variant text-sm text-center max-w-xs">
            Join some communities to see their posts in your feed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedPostCard 
              key={post.id} 
              post={post as unknown as PostRes} 
              onReact={handleReact} 
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="px-6 py-2 rounded-full text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
