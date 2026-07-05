import { describe, expect, it, vi } from "vitest";
import { SingleFlight } from "../src/concurrency/singleFlight";

describe("SingleFlight", () => {
  it("coalesces concurrent calls for the same key into one execution", async () => {
    const sf = new SingleFlight<number>();
    let callCount = 0;

    const fn = () =>
      new Promise<number>((resolve) => {
        callCount++;
        setTimeout(() => resolve(42), 50);
      });

    const [a, b, c] = await Promise.all([
      sf.run("key", fn),
      sf.run("key", fn),
      sf.run("key", fn),
    ]);

    expect(callCount).toBe(1);
    expect([a, b, c]).toEqual([42, 42, 42]);
  });

  it("allows a fresh call after the in-flight promise settles", async () => {
    const sf = new SingleFlight<number>();
    let callCount = 0;
    const fn = () => Promise.resolve(++callCount);

    const first = await sf.run("key", fn);
    const second = await sf.run("key", fn);

    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it("does not coalesce calls with different keys", async () => {
    const sf = new SingleFlight<number>();
    let callCount = 0;
    const fn = () => Promise.resolve(++callCount);

    const [a, b] = await Promise.all([sf.run("key-a", fn), sf.run("key-b", fn)]);
    expect(callCount).toBe(2);
    expect(a).not.toBe(b);
  });

  it("clears the in-flight entry even when the operation rejects", async () => {
    const sf = new SingleFlight<number>();
    const failing = () => Promise.reject(new Error("boom"));

    await expect(sf.run("key", failing)).rejects.toThrow("boom");
    expect(sf.pendingCount).toBe(0);

    const succeeding = () => Promise.resolve(1);
    await expect(sf.run("key", succeeding)).resolves.toBe(1);
  });
});
