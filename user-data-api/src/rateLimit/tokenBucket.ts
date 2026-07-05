interface TokenBucketOptions {
  /** Max tokens the bucket can hold — the burst allowance. */
  capacity: number;
  /** Tokens added per millisecond, derived from the sustained rate. */
  refillPerMs: number;
}

/**
 * Classic token bucket: starts full (`capacity` tokens), each request costs
 * 1 token, and tokens refill continuously at `refillPerMs`. This naturally
 * expresses both halves of the spec's rate limit:
 *   - "10 requests per minute" -> steady refill rate of 10/60000ms
 *   - "burst of 5 in a 10s window" -> capacity of 5, so a client can spend
 *     all 5 tokens immediately, then must wait for the slow refill
 * A fixed-window counter can't express both constraints at once without
 * being either too strict or too permissive at window boundaries; the token
 * bucket avoids that edge-case cliff.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;

  constructor(private readonly options: TokenBucketOptions) {
    this.tokens = options.capacity;
    this.lastRefillAt = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillAt;
    if (elapsedMs <= 0) return;

    this.tokens = Math.min(this.options.capacity, this.tokens + elapsedMs * this.options.refillPerMs);
    this.lastRefillAt = now;
  }

  /** Attempts to consume one token. Returns true if allowed, false if rate-limited. */
  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Milliseconds until at least one token will be available. */
  msUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    const deficit = 1 - this.tokens;
    return Math.ceil(deficit / this.options.refillPerMs);
  }
}

export class TokenBucketRegistry {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(private readonly makeOptions: () => TokenBucketOptions) {}

  bucketFor(clientKey: string): TokenBucket {
    let bucket = this.buckets.get(clientKey);
    if (!bucket) {
      bucket = new TokenBucket(this.makeOptions());
      this.buckets.set(clientKey, bucket);
    }
    return bucket;
  }
}
