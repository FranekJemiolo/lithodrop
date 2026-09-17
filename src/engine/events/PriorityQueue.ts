/**
 * PriorityQueue — Generic max-heap implementation.
 *
 * Used by DroneDispatchQueue to always service the highest-severity
 * hull damage event first.
 *
 * Time complexity:
 *   - push: O(log n)
 *   - pop:  O(log n)
 *   - peek: O(1)
 */

export class PriorityQueue<T> {
  private readonly heap: T[] = [];
  private readonly comparator: (a: T, b: T) => number;

  /**
   * @param comparator - Returns positive if `a` has higher priority than `b`.
   *   For a max-heap: (a, b) => a.priority - b.priority
   */
  constructor(comparator: (a: T, b: T) => number) {
    this.comparator = comparator;
  }

  /** Insert an item into the heap. O(log n) */
  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  /** Remove and return the highest-priority item. O(log n) */
  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const top = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.sinkDown(0);
    return top;
  }

  /** Return the highest-priority item without removing it. O(1) */
  peek(): T | undefined {
    return this.heap[0];
  }

  /** Current number of items in the queue. */
  get size(): number {
    return this.heap.length;
  }

  /** True if the queue is empty. */
  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /** Remove all items from the queue. */
  clear(): void {
    this.heap.length = 0;
  }

  /** Return all items (unordered). O(n) — for debugging only. */
  toArray(): T[] {
    return [...this.heap];
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.heap[index], this.heap[parentIndex]) <= 0) break;
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let highest = index;

      if (left < length && this.comparator(this.heap[left], this.heap[highest]) > 0) {
        highest = left;
      }
      if (right < length && this.comparator(this.heap[right], this.heap[highest]) > 0) {
        highest = right;
      }

      if (highest === index) break;
      this.swap(index, highest);
      index = highest;
    }
  }

  private swap(i: number, j: number): void {
    const tmp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = tmp;
  }
}
