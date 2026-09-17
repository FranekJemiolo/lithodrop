/**
 * Integration smoke test — verifies grid coordinate utilities work
 * correctly as an integrated system.
 */

import { describe, it, expect } from "vitest";
import {
  toGridKey,
  fromGridKey,
  getNeighborCoords,
  type GridCoord,
} from "../../src/engine/grid/types";

describe("Grid coordinate integration", () => {
  it("round-trips coordinates through key encoding", () => {
    const coords: GridCoord[] = [
      { qx: 0, qy: 0 },
      { qx: -5, qy: 3 },
      { qx: 100, qy: -100 },
    ];

    for (const coord of coords) {
      expect(fromGridKey(toGridKey(coord))).toEqual(coord);
    }
  });

  it("neighbor coordinates form a valid Von Neumann neighborhood", () => {
    const center: GridCoord = { qx: 0, qy: 0 };
    const neighbors = getNeighborCoords(center);

    // Exactly 4 orthogonal neighbors
    expect(neighbors).toHaveLength(4);

    // Each neighbor is exactly 1 step away
    for (const n of neighbors) {
      const dist = Math.abs(n.qx - center.qx) + Math.abs(n.qy - center.qy);
      expect(dist).toBe(1);
    }

    // No duplicates
    const keys = neighbors.map(toGridKey);
    expect(new Set(keys).size).toBe(4);
  });
});
