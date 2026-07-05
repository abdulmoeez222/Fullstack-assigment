import type { FlatSeat } from "../types/venue";

/**
 * Uniform grid spatial index.
 *
 * Seats in event venues are laid out at roughly-uniform density (rows/cols),
 * so a simple grid of buckets beats a quadtree here: O(1) insert, and lookups
 * only need to scan the seat's own cell plus 8 neighbors, which given real
 * seat spacing (~25-40px) is a handful of seats, not thousands.
 */
export class SpatialGrid {
  private readonly cellSize: number;
  private readonly buckets = new Map<string, FlatSeat[]>();

  constructor(seats: FlatSeat[], cellSize = 40) {
    this.cellSize = cellSize;
    for (const seat of seats) {
      const key = this.keyFor(seat.absX, seat.absY);
      const bucket = this.buckets.get(key);
      if (bucket) {
        bucket.push(seat);
      } else {
        this.buckets.set(key, [seat]);
      }
    }
  }

  private keyFor(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx}:${cy}`;
  }

  /** Finds the seat whose center is closest to (x, y), within maxDist pixels. */
  findNearest(x: number, y: number, maxDist = 14): FlatSeat | null {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    let best: FlatSeat | null = null;
    let bestDistSq = maxDist * maxDist;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.buckets.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const seat of bucket) {
          const ddx = seat.absX - x;
          const ddy = seat.absY - y;
          const distSq = ddx * ddx + ddy * ddy;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = seat;
          }
        }
      }
    }

    return best;
  }
}
