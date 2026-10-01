/**
 * A least-recently-used cache with a budget in bytes (and a count), for
 * things like decoded pictures: reading an entry makes it the newest, and
 * adding one drops the oldest entries until the budget holds again. An entry
 * bigger than the whole budget isn't kept.
 */
export class LruCache<V> {
  private readonly entries = new Map<string, { value: V; size: number }>();
  private total = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly sizeOf: (value: V) => number,
    private readonly maxEntries = 1000,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Re-insert, so Map order is least recently used first.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  set(key: string, value: V): void {
    const size = Math.max(0, this.sizeOf(value));
    this.delete(key);
    if (size > this.maxBytes) return;
    this.entries.set(key, { value, size });
    this.total += size;
    while (this.total > this.maxBytes || this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.total -= entry.size;
    return true;
  }

  clear(): void {
    this.entries.clear();
    this.total = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.total;
  }
}
