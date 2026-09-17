/**
 * Smoke tests — Verifies the core module graph is importable without errors.
 *
 * These tests should always pass and serve as a fast sanity check that
 * no circular imports or missing exports exist in the module tree.
 */

import { describe, it, expect } from "vitest";

describe("Module smoke tests", () => {
  it("EventBus module exports eventBus singleton", async () => {
    const { eventBus } = await import("../../src/engine/events/EventBus");
    expect(eventBus).toBeDefined();
    expect(typeof eventBus.on).toBe("function");
    expect(typeof eventBus.off).toBe("function");
    expect(typeof eventBus.emit).toBe("function");
  });

  it("grid/types module exports toGridKey and fromGridKey", async () => {
    const { toGridKey, fromGridKey, getNeighborCoords } = await import(
      "../../src/engine/grid/types"
    );
    expect(toGridKey({ qx: 3, qy: -2 })).toBe("3,-2");
    expect(fromGridKey("3,-2")).toEqual({ qx: 3, qy: -2 });
    const neighbors = getNeighborCoords({ qx: 0, qy: 0 });
    expect(neighbors).toHaveLength(4);
  });

  it("EventBus correctly routes typed events", async () => {
    const { eventBus } = await import("../../src/engine/events/EventBus");
    const received: number[] = [];

    const unsub = eventBus.on("ECONOMY_TICK", (payload) => {
      received.push(payload.credits);
    });

    eventBus.emit("ECONOMY_TICK", {
      credits: 1500,
      creditsPerSecond: 15,
      taxPerSecond: 5,
      netPerSecond: 10,
      upkeepDeficit: false,
    });

    expect(received).toEqual([1500]);
    unsub();

    // After unsubscribe, no more events received
    eventBus.emit("ECONOMY_TICK", {
      credits: 9999,
      creditsPerSecond: 0,
      taxPerSecond: 0,
      netPerSecond: 0,
      upkeepDeficit: false,
    });
    expect(received).toHaveLength(1);
  });

  it("EventBus clearAll removes all listeners", async () => {
    const { eventBus } = await import("../../src/engine/events/EventBus");
    let callCount = 0;

    eventBus.on("BANKRUPTCY", () => {
      callCount++;
    });
    eventBus.clearAll();
    eventBus.emit("BANKRUPTCY", {});

    expect(callCount).toBe(0);
  });
});
