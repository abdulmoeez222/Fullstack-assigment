export const config = {
  port: Number(process.env.PORT ?? 3000),

  cache: {
    ttlMs: 60_000, // entries invalidate after 60s
    maxEntries: 1000, // LRU eviction cap
    sweepIntervalMs: 10_000, // background stale-entry cleanup cadence
  },

  simulatedDb: {
    latencyMs: 200,
  },

  rateLimit: {
    // Token bucket: capacity 5 (burst), refills to a steady 10/min.
    burstCapacity: 5,
    sustainedPerMinute: 10,
    // A 10s burst window is expressed via the bucket's refill rate below.
  },
} as const;
