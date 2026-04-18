"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Hook for managing feed scroll pagination with prefetch support
 * 
 * @param hasMore - Whether there are more pages to load
 * @param isLoadingMore - Whether a page is currently being loaded
 * @param loadMore - Function to load the next page
 * @param prefetchNextPage - Function to prefetch the next page
 * @returns Current page and handler for loading more
 */
export function useFeedScroll(
  hasMore: boolean,
  isLoadingMore: boolean,
  loadMore: () => Promise<void>,
  prefetchNextPage: (page: number) => void
) {
  const [currentPage, setCurrentPage] = useState(0);

  const handleLoadMore = useCallback(async () => {
    setCurrentPage((p) => p + 1);
    await loadMore();
  }, [loadMore]);

  // Prefetch next page when conditions are right
  useEffect(() => {
    if (hasMore && !isLoadingMore) {
      prefetchNextPage(currentPage);
    }
  }, [hasMore, isLoadingMore, currentPage, prefetchNextPage]);

  return {
    currentPage,
    handleLoadMore,
  };
}
