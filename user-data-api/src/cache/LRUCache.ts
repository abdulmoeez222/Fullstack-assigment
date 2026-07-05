interface Node<V> {
  key: string;
  value: V;
  insertedAt: number;
  prev: Node<V> | null;
  next: Node<V> | null;
}

/**
 * LRU cache with per-entry TTL.
 *
 * Backed by a Map (for O(1) key lookup) + a doubly linked list (for O(1)
 * move-to-front and O(1) eviction of the least-recently-used tail). TTL is
 * checked lazily on read (an expired entry is treated as a miss and evicted)
 * and also swept proactively in the background via `evictExpired()`.
 */
export class LRUCache<V> {
  private readonly map = new Map<string, Node<V>>();
  private head: Node<V> | null = null; // most recently used
  private tail: Node<V> | null = null; // least recently used

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get size(): number {
    return this.map.size;
  }

  get(key: string): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;

    if (this.isExpired(node)) {
      this.removeNode(node);
      this.map.delete(key);
      return undefined;
    }

    this.moveToFront(node);
    return node.value;
  }

  has(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    if (this.isExpired(node)) {
      this.removeNode(node);
      this.map.delete(key);
      return false;
    }
    return true;
  }

  set(key: string, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.insertedAt = Date.now();
      this.moveToFront(existing);
      return;
    }

    const node: Node<V> = { key, value, insertedAt: Date.now(), prev: null, next: null };
    this.map.set(key, node);
    this.addToFront(node);

    if (this.map.size > this.maxEntries) {
      this.evictLru();
    }
  }

  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  /** Proactively removes all expired entries. Called by the background sweeper. */
  evictExpired(): number {
    let removed = 0;
    let node = this.tail;
    // Walk from LRU end; expired entries tend to accumulate there, but we
    // check the whole list since insertion order and TTL order can diverge
    // after updates.
    while (node) {
      const prev = node.prev;
      if (this.isExpired(node)) {
        this.removeNode(node);
        this.map.delete(node.key);
        removed++;
      }
      node = prev;
    }
    return removed;
  }

  private isExpired(node: Node<V>): boolean {
    return Date.now() - node.insertedAt > this.ttlMs;
  }

  private addToFront(node: Node<V>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: Node<V>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    node.prev = null;
    node.next = null;
  }

  private moveToFront(node: Node<V>): void {
    if (this.head === node) return;
    this.removeNode(node);
    this.addToFront(node);
  }

  private evictLru(): void {
    if (!this.tail) return;
    const evicted = this.tail;
    this.removeNode(evicted);
    this.map.delete(evicted.key);
  }
}
