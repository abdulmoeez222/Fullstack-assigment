/**
 * Coalesces concurrent calls for the same key into a single underlying
 * operation. If a fetch for key "5" is already in flight, a second request
 * for "5" awaits the same promise instead of triggering a duplicate
 * "database call". The in-flight entry is cleared once the promise settles
 * (success or failure), so the next miss starts a fresh fetch.
 */
export class SingleFlight<V> {
  private readonly inFlight = new Map<string, Promise<V>>();

  async run(key: string, fn: () => Promise<V>): Promise<V> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  get pendingCount(): number {
    return this.inFlight.size;
  }
}
