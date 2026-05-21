"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <button
        onClick={reset}
        className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
      >
        Try again
      </button>
    </div>
  );
}
