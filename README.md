# Fullstack Assignment

Two independently runnable projects — a React front-end and an Express back-end.

---

## Frontend — Interactive Seating Map (`/seating-map`)

Cinema-style interactive arena seating map built with React 18 + TypeScript + Vite.

```bash
cd seating-map
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # vitest unit tests
pnpm generate:venue   # generate a ~15 000-seat stress-test venue
```

**Highlights**
- Canvas rendering for 60fps performance with large seat counts
- Click + full keyboard navigation (arrow keys + Enter/Space)
- Up to 8 seats selectable with live subtotal
- Selection persisted to `localStorage`
- "View from your seat" — background image zooms & pans based on selected seat
- Accessible: `aria-label`, `aria-live`, visible focus ring

---

## Backend — User Data API (`/user-data-api`)

Express.js REST API with advanced caching, rate limiting, and async processing.

```bash
cd user-data-api
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # vitest unit tests
```

**Endpoints**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/:id` | Fetch user (cache-first, 200ms mock DB) |
| POST | `/users` | Create user (added to mock data + cached) |
| GET | `/cache-status` | Hits, misses, size, avg response time |
| DELETE | `/cache` | Clear entire cache |
| GET | `/health` | Liveness check |

**Highlights**
- Custom LRU cache with 60s TTL + background stale sweeper
- Token bucket rate limiting (burst 5, sustained 10 req/min)
- Single-flight concurrency coalescing (no duplicate DB calls)
- Array-based async queue with bounded concurrency (20 workers)

---

## Security notes

- `.env` files and any secrets are excluded via `.gitignore`
- `node_modules/` is excluded from version control
- Rate limiting protects the API from burst abuse
- All user input is validated before processing
