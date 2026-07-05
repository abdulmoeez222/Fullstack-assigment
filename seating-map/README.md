# Metropolis Arena — Seat Selection

## Running it

```bash
pnpm install
pnpm dev
```

Generate a full-scale (~15,000 seat) dataset for perf testing:

```bash
pnpm generate:venue
```

This overwrites `public/venue.json`. A small hand-written sample ships by
default so `pnpm dev` works immediately without generation.

Run tests:

```bash
pnpm test
```

## Architecture & trade-offs

**Rendering: Canvas, not SVG/DOM.** At ~15,000 seats, one DOM node per seat
(SVG `<circle>` or `<div>`) puts enough elements in the tree that browsers
start dropping frames on hover/selection re-renders, and React reconciliation
alone becomes a bottleneck. A single `<canvas>` redrawn imperatively avoids
both problems — draw calls are cheap and we're not fighting the DOM. The
trade-off is losing "seats are real elements," which is where accessibility
gets harder (see below).

**Hit-testing: uniform grid, not quadtree.** Seats in a venue are laid out at
roughly even density (rows and columns), so a quadtree's main advantage —
adapting to uneven point density — doesn't buy much here. A flat `Map` of
40px grid cells gives O(1) insertion and lookups that only need to scan a
3×3 neighborhood, which is a handful of seats even at 15k total.

**Keyboard accessibility on a canvas.** Canvas elements aren't individually
focusable, so seats can't get real DOM focus. The approach here is a
*virtual focus* model: one focused-seat index tracked in React state, arrow
keys move it to the nearest seat in that direction, and the canvas draws a
visible focus ring around whatever's focused. A visually-hidden
`aria-live="polite"` region announces the focused seat's details to screen
readers on every focus change. This is a reasonable middle ground, but it's
not equivalent to native focus — a screen reader user can't Tab directly to
"row 12, seat 4" the way they could with real buttons. If accessibility
were the top priority over raw seat count, I'd render a real (virtualized)
list of focusable seat buttons instead and accept the DOM node cost.

**Selection state as a pure reducer.** `selectionReducer` has no React
dependency, which makes it trivial to unit test in isolation (see
`tests/selectionStore.test.ts`) and easy to reason about the "reject" cases
(max 8 reached, seat not selectable) without threading UI concerns through
the logic.

**Persistence.** Selection is written to `localStorage`, debounced by
300ms so rapid toggling doesn't spam writes. On load, persisted seat IDs are
validated against the current venue data — a seat that's since been sold or
no longer exists is silently dropped rather than crashing the hydrate step.

## Incomplete / TODO

- No WebSocket live-status updates (stretch goal, not implemented).
- No heat-map toggle or "find N adjacent seats" helper.
- No pinch-zoom/pan for mobile — the map currently scrolls via container
  overflow on small viewports, which works but isn't as nice as native
  gesture support.
- No dark mode.
- Section labels/row numbers aren't drawn on the canvas itself (only in the
  details panel) — for a real venue map you'd want section headers rendered
  directly on the map for orientation.
- Tests cover the reducer and spatial index; no component or e2e tests yet.

## Testing

`pnpm test` runs Vitest unit tests against the selection reducer and spatial
grid — the two pieces of logic that are cheapest to get wrong and most
valuable to pin down with tests. Manual testing was done in Chrome/Firefox
at both a small sample venue and a generated 15k-seat venue to confirm
interaction stays responsive.
