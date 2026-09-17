/**
 * PriorityQueue unit tests — max-heap invariants and edge cases.
 */

import { describe, it, expect } from "vitest";
import { PriorityQueue } from "../../../src/engine/events/PriorityQueue";

interface Task {
  id: string;
  priority: number;
}

const comparator = (a: Task, b: Task): number => a.priority - b.priority;

describe("PriorityQueue (max-heap)", () => {
  it("is initially empty", () => {
    const pq = new PriorityQueue<Task>(comparator);
    expect(pq.isEmpty).toBe(true);
    expect(pq.size).toBe(0);
  });

  it("push and pop single item", () => {
    const pq = new PriorityQueue<Task>(comparator);
    pq.push({ id: "a", priority: 5 });
    expect(pq.size).toBe(1);
    expect(pq.isEmpty).toBe(false);
    const item = pq.pop();
    expect(item?.id).toBe("a");
    expect(pq.isEmpty).toBe(true);
  });

  it("pop returns highest priority item first", () => {
    const pq = new PriorityQueue<Task>(comparator);
    pq.push({ id: "low", priority: 2 });
    pq.push({ id: "high", priority: 9 });
    pq.push({ id: "mid", priority: 5 });

    expect(pq.pop()?.id).toBe("high");
    expect(pq.pop()?.id).toBe("mid");
    expect(pq.pop()?.id).toBe("low");
  });

  it("pop from empty queue returns undefined", () => {
    const pq = new PriorityQueue<Task>(comparator);
    expect(pq.pop()).toBeUndefined();
  });

  it("peek returns highest priority without removing", () => {
    const pq = new PriorityQueue<Task>(comparator);
    pq.push({ id: "a", priority: 3 });
    pq.push({ id: "b", priority: 8 });

    const top = pq.peek();
    expect(top?.id).toBe("b");
    expect(pq.size).toBe(2); // unchanged
  });

  it("maintains heap invariant with 100 random insertions", () => {
    const pq = new PriorityQueue<Task>(comparator);
    const priorities: number[] = [];

    // Use a seeded sequence for determinism
    for (let i = 0; i < 100; i++) {
      const p = (i * 137 + 42) % 100; // pseudo-random sequence
      priorities.push(p);
      pq.push({ id: `task_${i}`, priority: p });
    }

    const sorted = [...priorities].sort((a, b) => b - a); // descending
    const extracted: number[] = [];
    while (!pq.isEmpty) {
      extracted.push(pq.pop()!.priority);
    }

    expect(extracted).toEqual(sorted);
  });

  it("clear empties the queue", () => {
    const pq = new PriorityQueue<Task>(comparator);
    pq.push({ id: "a", priority: 1 });
    pq.push({ id: "b", priority: 2 });
    pq.clear();
    expect(pq.isEmpty).toBe(true);
    expect(pq.size).toBe(0);
  });

  it("handles duplicate priorities correctly", () => {
    const pq = new PriorityQueue<Task>(comparator);
    pq.push({ id: "a", priority: 5 });
    pq.push({ id: "b", priority: 5 });
    pq.push({ id: "c", priority: 5 });

    // All should be returned (in any order, just that all 3 come out)
    const ids = [pq.pop()?.id, pq.pop()?.id, pq.pop()?.id];
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
  });
});
