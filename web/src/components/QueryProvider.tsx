"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale-while-revalidate pattern
            staleTime: 60 * 1000, // Data is fresh for 60 seconds (standardized)
            gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
            refetchOnWindowFocus: false, // Avoid refetching when switching tabs
            retry: 2, // Retry failed requests 2 times
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
          },
          mutations: {
            retry: 1, // Retry mutations once
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
