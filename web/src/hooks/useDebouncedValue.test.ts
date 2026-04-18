import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("should debounce string value changes", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    );

    expect(result.current).toBe("initial");

    act(() => {
      rerender({ value: "changed", delay: 300 });
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("changed");
  });

  it("should use default delay of 300ms", async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      {
        initialProps: { value: "initial" },
      }
    );

    act(() => {
      rerender({ value: "changed" });
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("changed");
  });

  it("should handle custom delay", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      }
    );

    act(() => {
      rerender({ value: "changed", delay: 500 });
    });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("changed");
  });

  it("should reset timer on rapid changes", async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      {
        initialProps: { value: "initial" },
      }
    );

    act(() => {
      rerender({ value: "first" });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("initial");

    act(() => {
      rerender({ value: "second" });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("second");
  });

  it("should work with number type", async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue<number>(value, 300),
      {
        initialProps: { value: 0 },
      }
    );

    act(() => {
      rerender({ value: 42 });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(42);
  });

  it("should work with object type", async () => {
    type SearchFilters = { query: string; category: string };
    const initialFilters: SearchFilters = { query: "", category: "all" };
    const newFilters: SearchFilters = { query: "test", category: "music" };

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue<SearchFilters>(value, 300),
      {
        initialProps: { value: initialFilters },
      }
    );

    act(() => {
      rerender({ value: newFilters });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toEqual(newFilters);
  });

  it("should cleanup timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const { unmount } = renderHook(() => useDebouncedValue("test", 300));

    act(() => {
      unmount();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
