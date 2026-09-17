/**
 * GridState unit tests — placement, removal, neighbor lookup, serialization.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GridState } from "../../../src/engine/grid/GridState";

describe("GridState", () => {
  let grid: GridState;

  beforeEach(() => {
    grid = new GridState();
  });

  it("places a module and retrieves it", () => {
    const instance = grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    expect(instance).toBeDefined();
    expect(instance.type).toBe("titanium_foundation");
    expect(instance.qx).toBe(0);
    expect(instance.qy).toBe(0);
    expect(instance.health).toBe(100);
    expect(instance.isActive).toBe(true);
  });

  it("getModule returns null for empty cell", () => {
    expect(grid.getModule({ qx: 5, qy: 5 })).toBeNull();
  });

  it("getModule returns placed module", () => {
    grid.placeModule({ qx: 2, qy: -1 }, "solar_array");
    const result = grid.getModule({ qx: 2, qy: -1 });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("solar_array");
  });

  it("throws when placing on occupied cell", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    expect(() => grid.placeModule({ qx: 0, qy: 0 }, "solar_array")).toThrow();
  });

  it("removeModule returns the removed instance", () => {
    grid.placeModule({ qx: 1, qy: 1 }, "crew_habitat");
    const removed = grid.removeModule({ qx: 1, qy: 1 });
    expect(removed).not.toBeNull();
    expect(removed!.type).toBe("crew_habitat");
    expect(grid.getModule({ qx: 1, qy: 1 })).toBeNull();
  });

  it("removeModule returns null for empty cell", () => {
    expect(grid.removeModule({ qx: 99, qy: 99 })).toBeNull();
  });

  it("isOccupied correctly reports cell state", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "fission_reactor");
    expect(grid.isOccupied({ qx: 0, qy: 0 })).toBe(true);
    expect(grid.isOccupied({ qx: 1, qy: 0 })).toBe(false);
  });

  it("getOccupiedNeighbors returns only occupied adjacent cells", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 0 }, "solar_array");
    grid.placeModule({ qx: 0, qy: 1 }, "crew_habitat");
    // Above and left are empty

    const neighbors = grid.getOccupiedNeighbors({ qx: 0, qy: 0 });
    expect(neighbors).toHaveLength(2);
    const types = neighbors.map((n) => n.type);
    expect(types).toContain("solar_array");
    expect(types).toContain("crew_habitat");
  });

  it("getAllModules returns all placed modules", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 0 }, "solar_array");
    grid.placeModule({ qx: -1, qy: 0 }, "battery_bank");
    expect(grid.getAllModules()).toHaveLength(3);
  });

  it("size property tracks placed module count", () => {
    expect(grid.size).toBe(0);
    grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    expect(grid.size).toBe(1);
    grid.removeModule({ qx: 0, qy: 0 });
    expect(grid.size).toBe(0);
  });

  it("updateModule modifies health in place", () => {
    const instance = grid.placeModule({ qx: 0, qy: 0 }, "crew_habitat");
    grid.updateModule(instance.instanceId, { health: 65 });
    const updated = grid.getModule({ qx: 0, qy: 0 });
    expect(updated!.health).toBe(65);
  });

  it("round-trips through JSON serialization", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 0 }, "solar_array");

    const json = grid.toJSON();
    const grid2 = new GridState();
    grid2.fromJSON(json);

    expect(grid2.size).toBe(2);
    expect(grid2.getModule({ qx: 0, qy: 0 })?.type).toBe("titanium_foundation");
    expect(grid2.getModule({ qx: 1, qy: 0 })?.type).toBe("solar_array");
  });
});
