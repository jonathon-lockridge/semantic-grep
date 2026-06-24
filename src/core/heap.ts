/**
 * Minimal binary heap. `higherPriority(a, b)` returns true when `a` should sit
 * above `b` (i.e. be popped first). HNSW uses two of these per search: a
 * max-by-similarity heap for the candidate frontier (expand the nearest first)
 * and a min-by-similarity heap for the result set (evict the farthest first).
 */
export class BinaryHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly higherPriority: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T {
    return this.items[0];
  }

  push(value: T): void {
    const items = this.items;
    items.push(value);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.higherPriority(items[i], items[parent])) {
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      } else break;
    }
  }

  pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop() as T;
    if (items.length > 0) {
      items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftDown(start: number): void {
    const items = this.items;
    const n = items.length;
    let i = start;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let best = i;
      if (left < n && this.higherPriority(items[left], items[best])) best = left;
      if (right < n && this.higherPriority(items[right], items[best])) best = right;
      if (best === i) break;
      [items[i], items[best]] = [items[best], items[i]];
      i = best;
    }
  }

  toArray(): T[] {
    return this.items.slice();
  }
}
