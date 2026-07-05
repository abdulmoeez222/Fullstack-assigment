export class CacheStats {
  private hits = 0;
  private misses = 0;
  private totalResponseTimeMs = 0;
  private responseCount = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  recordResponseTime(ms: number): void {
    this.totalResponseTimeMs += ms;
    this.responseCount++;
  }

  snapshot(currentSize: number) {
    return {
      hits: this.hits,
      misses: this.misses,
      size: currentSize,
      averageResponseTimeMs:
        this.responseCount === 0 ? 0 : Math.round(this.totalResponseTimeMs / this.responseCount),
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.totalResponseTimeMs = 0;
    this.responseCount = 0;
  }
}
