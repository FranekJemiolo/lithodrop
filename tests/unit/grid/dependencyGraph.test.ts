/**
 * DependencyGraph unit tests — power propagation, adjacency multipliers,
 * BFS pathfinding, resource flow summary.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GridState } from "../../../src/engine/grid/GridState";
import { DependencyGraph } from "../../../src/engine/grid/DependencyGraph";

describe("DependencyGraph — power propagation", () => {
  let grid: GridState;
  let graph: DependencyGraph;

  beforeEach(() => {
    grid = new GridState();
    graph = new DependencyGraph();
  });

  it("power source modules are always powered", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "fission_reactor");
    graph.rebuild(grid);

    const mod = grid.getModule({ qx: 0, qy: 0 })!;
    const node = graph.getNode(mod.instanceId);
    expect(node?.isPowered).toBe(true);
  });

  it("consumer adjacent to power source gets powered", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "solar_array");
    grid.placeModule({ qx: 1, qy: 0 }, "crew_habitat");
    graph.rebuild(grid);

    const habitat = grid.getModule({ qx: 1, qy: 0 })!;
    const node = graph.getNode(habitat.instanceId);
    expect(node?.isPowered).toBe(true);
  });

  it("consumer NOT adjacent to power source is not powered", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "solar_array");
    grid.placeModule({ qx: 5, qy: 5 }, "crew_habitat"); // far away, no connection
    graph.rebuild(grid);

    const habitat = grid.getModule({ qx: 5, qy: 5 })!;
    const node = graph.getNode(habitat.instanceId);
    expect(node?.isPowered).toBe(false);
  });

  it("power propagates through a chain of modules", () => {
    // reactor → habitat → science lab (3 hops)
    grid.placeModule({ qx: 0, qy: 0 }, "fission_reactor");
    grid.placeModule({ qx: 1, qy: 0 }, "crew_habitat");
    grid.placeModule({ qx: 2, qy: 0 }, "science_lab");
    graph.rebuild(grid);

    const lab = grid.getModule({ qx: 2, qy: 0 })!;
    const node = graph.getNode(lab.instanceId);
    expect(node?.isPowered).toBe(true);
  });

  it("module with no neighbors and no power source is unpowered", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "crew_habitat");
    graph.rebuild(grid);

    const mod = grid.getModule({ qx: 0, qy: 0 })!;
    const node = graph.getNode(mod.instanceId);
    expect(node?.isPowered).toBe(false);
  });
});

describe("DependencyGraph — adjacency multipliers", () => {
  let grid: GridState;
  let graph: DependencyGraph;

  beforeEach(() => {
    grid = new GridState();
    graph = new DependencyGraph();
  });

  it("deep_core_drill alone has multiplier = 1.0", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "fission_reactor"); // power source
    grid.placeModule({ qx: 0, qy: 1 }, "deep_core_drill");
    graph.rebuild(grid);

    const drill = grid.getModule({ qx: 0, qy: 1 })!;
    const node = graph.getNode(drill.instanceId);
    expect(node?.adjacencyMultiplier).toBe(1.0);
  });

  it("deep_core_drill adjacent to science_lab has multiplier > 1.0", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "fission_reactor");
    grid.placeModule({ qx: 1, qy: 0 }, "deep_core_drill");
    grid.placeModule({ qx: 2, qy: 0 }, "science_lab");
    graph.rebuild(grid);

    const drill = grid.getModule({ qx: 1, qy: 0 })!;
    const node = graph.getNode(drill.instanceId);
    expect(node?.adjacencyMultiplier).toBeGreaterThan(1.0);
    expect(node?.adjacencyMultiplier).toBeCloseTo(1.2, 2);
  });

  it("science_lab adjacent to both crew_habitat and comms_relay stacks bonuses", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "fission_reactor");
    grid.placeModule({ qx: 1, qy: 0 }, "science_lab");
    grid.placeModule({ qx: 2, qy: 0 }, "crew_habitat");
    grid.placeModule({ qx: 1, qy: 1 }, "comms_relay");
    graph.rebuild(grid);

    const lab = grid.getModule({ qx: 1, qy: 0 })!;
    const node = graph.getNode(lab.instanceId);
    // Crew habitat: 1.25, Comms relay: 1.4, combined: 1.25 × 1.4 = 1.75
    expect(node?.adjacencyMultiplier).toBeCloseTo(1.75, 2);
  });
});

describe("DependencyGraph — resource flow summary", () => {
  it("returns correct power totals for a simple colony", () => {
    const grid = new GridState();
    const graph = new DependencyGraph();

    grid.placeModule({ qx: 0, qy: 0 }, "solar_array");   // +40 power
    grid.placeModule({ qx: 1, qy: 0 }, "crew_habitat");  // -20 power

    const flow = graph.rebuild(grid);

    expect(flow.powerGenerated).toBe(40);
    expect(flow.powerConsumed).toBe(20);
  });

  it("unpowered consumers don't contribute to powerConsumed", () => {
    const grid = new GridState();
    const graph = new DependencyGraph();

    // crew_habitat isolated — no power source adjacent
    grid.placeModule({ qx: 5, qy: 5 }, "crew_habitat");

    const flow = graph.rebuild(grid);
    // Should be 0 because it's not powered
    expect(flow.powerConsumed).toBe(0);
  });

  it("deep_core_drill produces minerals when powered", () => {
    const grid = new GridState();
    const graph = new DependencyGraph();

    grid.placeModule({ qx: 0, qy: 0 }, "fission_reactor"); // power
    grid.placeModule({ qx: 1, qy: 0 }, "deep_core_drill"); // minerals
    const flow = graph.rebuild(grid);

    expect(flow.mineralsPerSecond).toBeGreaterThan(0);
  });
});

describe("DependencyGraph — BFS pathfinding", () => {
  it("finds a direct path between adjacent modules", () => {
    const grid = new GridState();
    const graph = new DependencyGraph();

    const m1 = grid.placeModule({ qx: 0, qy: 0 }, "robotics_hub");
    const m2 = grid.placeModule({ qx: 1, qy: 0 }, "crew_habitat");
    graph.rebuild(grid);

    const path = graph.findPath(grid, m1.instanceId, m2.instanceId);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2); // [start, end]
  });

  it("returns null when target is not connected", () => {
    const grid = new GridState();
    const graph = new DependencyGraph();

    const m1 = grid.placeModule({ qx: 0, qy: 0 }, "robotics_hub");
    const m2 = grid.placeModule({ qx: 5, qy: 5 }, "crew_habitat"); // not adjacent
    graph.rebuild(grid);

    const path = graph.findPath(grid, m1.instanceId, m2.instanceId);
    expect(path).toBeNull();
  });

  it("finds a 3-hop path through a chain", () => {
    const grid = new GridState();
    const graph = new DependencyGraph();

    const m1 = grid.placeModule({ qx: 0, qy: 0 }, "robotics_hub");
    grid.placeModule({ qx: 1, qy: 0 }, "titanium_foundation");
    const m3 = grid.placeModule({ qx: 2, qy: 0 }, "crew_habitat");
    graph.rebuild(grid);

    const path = graph.findPath(grid, m1.instanceId, m3.instanceId);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3); // [hub, foundation, habitat]
  });
});
