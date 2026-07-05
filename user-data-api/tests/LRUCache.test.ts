import { describe, expect, it, vi } from "vitest";
import { LRUCache } from "../src/cache/LRUCache";

describe("LRUCache", () => {
  it("stores and retrieves values", () => {
    const cache = new LRUCache<string>(10, 60_000);
    cache.set("a", "1");
    expect(cache.get("a")).toBe("1");
  });

  it("evicts the least recently used entry when over capacity", () => {
    const cache = new LRUCache<string>(2, 60_000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a"); // touch "a" so "b" becomes LRU
    cache.set("c", "3"); // should evict "b"

    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
  });

  it("expires entries after the TTL", () => {
    vi.useFakeTimers();
    const cache = new LRUCache<string>(10, 1000);
    cache.set("a", "1");

    vi.advanceTimersByTime(1001);
    expect(cache.get("a")).toBeUndefined();
    vi.useRealTimers();
  });

  it("evictExpired removes only stale entries", () => {
    vi.useFakeTimers();
    const cache = new LRUCache<string>(10, 1000);
    cache.set("a", "1");
    vi.advanceTimersByTime(500);
    cache.set("b", "2");
    vi.advanceTimersByTime(600); // "a" now 1100ms old, "b" 600ms old

    const removed = cache.evictExpired();
    expect(removed).toBe(1);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    vi.useRealTimers();
  });

  it("reports accurate size", () => {
    const cache = new LRUCache<string>(10, 60_000);
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.size).toBe(2);
    cache.delete("a");
    expect(cache.size).toBe(1);
  });
});
