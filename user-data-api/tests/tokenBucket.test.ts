import { describe, expect, it, vi } from "vitest";
import { TokenBucket } from "../src/rateLimit/tokenBucket";

describe("TokenBucket", () => {
  it("allows requests up to burst capacity", () => {
    const bucket = new TokenBucket({ capacity: 5, refillPerMs: 10 / 60_000 });
    for (let i = 0; i < 5; i++) {
      expect(bucket.tryConsume()).toBe(true);
    }
    expect(bucket.tryConsume()).toBe(false);
  });

  it("refills over time at the sustained rate", () => {
    vi.useFakeTimers();
    const bucket = new TokenBucket({ capacity: 5, refillPerMs: 10 / 60_000 });

    for (let i = 0; i < 5; i++) bucket.tryConsume();
    expect(bucket.tryConsume()).toBe(false);

    // 10 tokens/min => 1 token every 6000ms
    vi.advanceTimersByTime(6000);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);

    vi.useRealTimers();
  });

  it("reports time until next token is available", () => {
    const bucket = new TokenBucket({ capacity: 1, refillPerMs: 10 / 60_000 });
    bucket.tryConsume();
    const wait = bucket.msUntilNextToken();
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(6000);
  });

  it("never exceeds capacity even after long idle periods", () => {
    vi.useFakeTimers();
    const bucket = new TokenBucket({ capacity: 5, refillPerMs: 10 / 60_000 });
    vi.advanceTimersByTime(10 * 60_000); // 10 minutes idle

    let consumed = 0;
    while (bucket.tryConsume()) consumed++;
    expect(consumed).toBe(5);
    vi.useRealTimers();
  });
});
