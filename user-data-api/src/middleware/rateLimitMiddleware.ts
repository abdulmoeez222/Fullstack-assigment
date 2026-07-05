import type { NextFunction, Request, Response } from "express";
import { TokenBucketRegistry } from "../rateLimit/tokenBucket";
import { config } from "../config";

const refillPerMs = config.rateLimit.sustainedPerMinute / 60_000;

const registry = new TokenBucketRegistry(() => ({
  capacity: config.rateLimit.burstCapacity,
  refillPerMs,
}));

/** Keys buckets by client IP. In production you'd likely key by API key/user id instead. */
function clientKeyFor(req: Request): string {
  return req.ip ?? "unknown";
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const bucket = registry.bucketFor(clientKeyFor(req));

  if (bucket.tryConsume()) {
    next();
    return;
  }

  const retryAfterMs = bucket.msUntilNextToken();
  res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
  res.status(429).json({
    error: "Too Many Requests",
    message: `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
  });
}
