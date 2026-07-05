import { describe, expect, it } from "vitest";
import { SpatialGrid } from "../src/utils/spatialIndex";
import type { FlatSeat } from "../src/types/venue";

function makeSeat(id: string, absX: number, absY: number): FlatSeat {
  return {
    id,
    col: 1,
    x: absX,
    y: absY,
    priceTier: 1,
    status: "available",
    sectionId: "A",
    sectionLabel: "A",
    rowIndex: 1,
    absX,
    absY,
  };
}

describe("SpatialGrid", () => {
  it("finds the exact seat under a point", () => {
    const seats = [makeSeat("s1", 50, 50), makeSeat("s2", 100, 100)];
    const grid = new SpatialGrid(seats);
    const found = grid.findNearest(50, 50);
    expect(found?.id).toBe("s1");
  });

  it("finds the nearest seat within tolerance", () => {
    const seats = [makeSeat("s1", 50, 50), makeSeat("s2", 200, 200)];
    const grid = new SpatialGrid(seats);
    const found = grid.findNearest(52, 48);
    expect(found?.id).toBe("s1");
  });

  it("returns null when nothing is within maxDist", () => {
    const seats = [makeSeat("s1", 50, 50)];
    const grid = new SpatialGrid(seats);
    const found = grid.findNearest(500, 500);
    expect(found).toBeNull();
  });

  it("scales to thousands of seats without correctness loss", () => {
    const seats: FlatSeat[] = [];
    for (let i = 0; i < 15000; i++) {
      seats.push(makeSeat(`s${i}`, (i % 100) * 30, Math.floor(i / 100) * 30));
    }
    const grid = new SpatialGrid(seats);
    const target = seats[7000];
    expect(target).toBeDefined();
    const found = grid.findNearest(target!.absX, target!.absY);
    expect(found?.id).toBe(target!.id);
  });
});
