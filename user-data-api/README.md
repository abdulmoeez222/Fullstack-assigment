# User Data API

## Running it

```bash
pnpm install
pnpm dev      # tsx watch, http://localhost:3000
```

```bash
pnpm build && pnpm start   # production build
```

```bash
pnpm test         # vitest unit tests
```

A Postman collection is in `postman/user-data-api.postman_collection.json` —
import it to manually exercise every endpoint, including repeated `GET
/users/:id` calls to observe the cache-hit latency drop.

## Endpoints

| Method | Path             | Description                                  |
|--------|------------------|-----------------------------------------------|
| GET    | `/users/:id`     | Fetch a user, cache-first                     |
| POST   | `/users`         | Create a user (added to mock data + cached)   |
| GET    | `/cache-status`  | Cache size, hits, misses, avg response time   |
| DELETE | `/cache`         | Clear the entire cache                        |
| GET    | `/health`        | Liveness check                                |

## Caching strategy

`LRUCache` is a doubly-linked-list + `Map` implementation: O(1) get/set,
O(1) move-to-front on access, O(1) eviction of the least-recently-used tail
once `maxEntries` is exceeded. Each entry also carries an `insertedAt`
timestamp; on read, an entry older than 60s (`config.cache.ttlMs`) is treated
as a miss and evicted — this is lazy, read-triggered expiry.

Because lazy expiry only cleans up entries someone actually asks for, a
background sweeper (`startStaleSweeper`, every 10s) proactively walks the
cache and evicts anything past its TTL, so memory doesn't hold onto dead
entries under low traffic.

Per the spec, a cache entry is only written if it isn't already cached —
`userCache.has(key)` is checked before `set()` after a DB fetch, since a
concurrent request (see single-flight, below) may have already populated it.

## Concurrency: single-flight coalescing

If two requests for the same uncached user ID arrive close together, we
don't want two simulated "DB calls." `SingleFlight` keeps a
`Map<key, Promise>` of in-flight operations — a second request for the same
key awaits the *same* promise as the first, rather than starting its own.
The entry is removed from the map once the promise settles (via
`.finally()`), whether it resolved or rejected, so a later request for the
same id (after the first completes) triggers a fresh fetch rather than
reusing a stale promise.

## Asynchronous processing: bounded queue

`RequestQueue` is a small array-based FIFO with a fixed worker pool
(default concurrency 20). Route handlers enqueue the simulated DB fetch
rather than calling it directly; this decouples "how many requests came in"
from "how many DB operations run at once," which matters under bursty
traffic — excess work queues up and drains as capacity frees, instead of
firing everything at the mock datastore simultaneously. Single-flight and
the queue compose: single-flight prevents duplicate work for the *same* id;
the queue caps total concurrent work across *all* ids.

## Rate limiting: token bucket

The spec asks for two constraints at once — "10 requests/min sustained" and
"burst of 5 in 10s" — which a simple fixed-window counter can't express
cleanly (it either double-counts near window boundaries or is too strict
mid-window). A token bucket handles both naturally:

- **Capacity = 5** — a client can spend all 5 tokens back-to-back (the burst).
- **Refill rate = 10/60000ms** — tokens regenerate continuously at the
  sustained rate, so after bursting, the client waits ~6s per additional
  request until the bucket rebuilds.

Buckets are keyed per client IP (`TokenBucketRegistry`), stored in memory.
A client over the limit gets `429` with a `Retry-After` header computed from
`msUntilNextToken()`.

**Trade-off:** buckets are per-process, in-memory — fine for this exercise,
but wouldn't survive a restart or scale across multiple instances without a
shared store like Redis.

## Error handling

- `GET /users/:id` validates that `id` is a positive integer before doing
  any work (`400` otherwise), returns `404` for ids not in the mock dataset,
  and `500` with a generic message if the queue/DB simulation throws.
- A global `errorHandler` middleware catches anything unhandled and a
  `notFoundHandler` covers unmatched routes.
- Logging is structured JSON (`src/utils/logger.ts`) so response times and
  errors are easy to grep/pipe into a log aggregator.

## Testing

Unit tests cover the three trickiest pieces in isolation:
- `LRUCache` — eviction order, TTL expiry, sweep behavior (`tests/LRUCache.test.ts`)
- `TokenBucket` — burst exhaustion, refill timing, capacity ceiling (`tests/tokenBucket.test.ts`)
- `SingleFlight` — coalescing, key isolation, rejection handling (`tests/singleFlight.test.ts`)

Manual testing via Postman: hit `GET /users/1` twice and compare response
times (first ~200ms simulated latency, second near-instant from cache); fire
6+ rapid requests to see the 429 kick in after the burst capacity is spent;
use `DELETE /cache` + `GET /cache-status` to confirm cache state resets.

## Additional Challenge (monitoring) — not implemented

`cacheStats.snapshot()` already exposes hits/misses/avg response time via
`/cache-status`, which covers the basics. A fuller Prometheus setup
(`prom-client`, a `/metrics` endpoint, histograms per route) would be the
natural next step but wasn't implemented here in the interest of time.
