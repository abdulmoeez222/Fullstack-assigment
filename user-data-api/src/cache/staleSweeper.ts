import type { LRUCache } from "./LRUCache";

/**
 * Runs `evictExpired` on an interval so TTL'd entries don't linger in memory
 * just because nobody happened to read them (lazy expiry-on-read alone would
 * leave dead entries occupying cache slots indefinitely under low traffic).
 */
export function startStaleSweeper<V>(cache: LRUCache<V>, intervalMs: number): () => void {
  const handle = setInterval(() => {
    cache.evictExpired();
  }, intervalMs);

  // Return a stop function for clean shutdown (and for tests).
  return () => clearInterval(handle);
}
