/**
 * TechTree unit tests — prerequisite chains, modifier computation, serialization.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TechTree } from "../../../src/engine/progression/TechTree";

describe("TechTree — structure", () => {
  it("has exactly 12 nodes", () => {
    const tree = new TechTree();
    expect(tree.getAllNodes()).toHaveLength(12);
  });

  it("has 4 nodes per branch", () => {
    const tree = new TechTree();
    expect(tree.getBranchNodes("engineering")).toHaveLength(4);
    expect(tree.getBranchNodes("operations")).toHaveLength(4);
    expect(tree.getBranchNodes("science")).toHaveLength(4);
  });

  it("branch nodes are sorted by cost ascending", () => {
    const tree = new TechTree();
    for (const branch of ["engineering", "operations", "science"] as const) {
      const nodes = tree.getBranchNodes(branch);
      for (let i = 1; i < nodes.length; i++) {
        expect(nodes[i].cost).toBeGreaterThanOrEqual(nodes[i - 1].cost);
      }
    }
  });

  it("starts with all nodes locked", () => {
    const tree = new TechTree();
    for (const node of tree.getAllNodes()) {
      expect(node.unlocked).toBe(false);
    }
  });
});

describe("TechTree — prerequisites", () => {
  let tree: TechTree;

  beforeEach(() => {
    tree = new TechTree();
  });

  it("root nodes can be unlocked without prerequisites", () => {
    expect(tree.canUnlock("improved_struts")).toBe(true);
    expect(tree.canUnlock("fuel_efficiency")).toBe(true);
    expect(tree.canUnlock("data_compression")).toBe(true);
  });

  it("non-root nodes cannot be unlocked without prerequisites", () => {
    expect(tree.canUnlock("reinforced_hull")).toBe(false);
    expect(tree.canUnlock("overclocked_thrusters")).toBe(false);
    expect(tree.canUnlock("mineral_assay")).toBe(false);
  });

  it("unlocking root enables unlocking its child", () => {
    tree.unlock("improved_struts", 100);
    expect(tree.canUnlock("reinforced_hull")).toBe(true);
  });

  it("already-unlocked node cannot be unlocked again", () => {
    tree.unlock("improved_struts", 100);
    expect(tree.canUnlock("improved_struts")).toBe(false);
  });

  it("fails unlock with insufficient data points", () => {
    const result = tree.unlock("improved_struts", 0); // costs 5
    expect(result.success).toBe(false);
    expect(result.cost).toBe(5);
  });

  it("succeeds unlock with sufficient data points", () => {
    const result = tree.unlock("improved_struts", 10);
    expect(result.success).toBe(true);
    expect(tree.getNode("improved_struts")?.unlocked).toBe(true);
  });
});

describe("TechTree — modifiers", () => {
  it("default modifiers are all 1.0 when nothing unlocked", () => {
    const tree = new TechTree();
    const mods = tree.getModifiers();

    expect(mods.impactToleranceMultiplier).toBe(1.0);
    expect(mods.fuelConsumptionMultiplier).toBe(1.0);
    expect(mods.thrusterForceMultiplier).toBe(1.0);
    expect(mods.scienceLabMultiplier).toBe(1.0);
  });

  it("fuel_efficiency reduces fuel consumption to 0.8×", () => {
    const tree = new TechTree();
    tree.unlock("fuel_efficiency", 100);
    const mods = tree.getModifiers();
    expect(mods.fuelConsumptionMultiplier).toBeCloseTo(0.8, 5);
  });

  it("reinforced_hull + precision_landing stack impact tolerance to 1.38×", () => {
    const tree = new TechTree([
      "improved_struts",
      "reinforced_hull",
      "fuel_efficiency",
      "overclocked_thrusters",
      "dual_engine",
      "precision_landing",
    ]);
    const mods = tree.getModifiers();
    // 1.2 × 1.15 = 1.38
    expect(mods.impactToleranceMultiplier).toBeCloseTo(1.38, 2);
  });

  it("overclocked_thrusters boosts force to 1.25×", () => {
    const tree = new TechTree(["fuel_efficiency", "overclocked_thrusters"]);
    const mods = tree.getModifiers();
    expect(mods.thrusterForceMultiplier).toBeCloseTo(1.25, 5);
  });

  it("quantum_anchoring reduces anchor power requirement to 0.7×", () => {
    const tree = new TechTree([
      "improved_struts",
      "reinforced_hull",
      "advanced_alloys",
      "quantum_anchoring",
    ]);
    const mods = tree.getModifiers();
    expect(mods.anchorPowerMultiplier).toBeCloseTo(0.7, 5);
  });

  it("dual_engine boosts RCS torque by +40%", () => {
    const tree = new TechTree(["fuel_efficiency", "overclocked_thrusters", "dual_engine"]);
    const mods = tree.getModifiers();
    expect(mods.rcsTorqueMultiplier).toBeCloseTo(1.4, 5);
  });

  it("prevents double-spending and cannot unlock the same node twice", () => {
    const tree = new TechTree();
    let balance = 10;
    const res1 = tree.unlock("improved_struts", balance);
    expect(res1.success).toBe(true);
    balance -= res1.cost;
    expect(balance).toBe(5);

    // Attempt double-spend on the exact same node
    const res2 = tree.unlock("improved_struts", balance);
    expect(res2.success).toBe(false);
    expect(res2.cost).toBe(0);
    // Balance remains untouched
    expect(balance).toBe(5);
  });

  it("rejects unlocks when points balance is insufficient and prevents negative points", () => {
    const tree = new TechTree();
    let balance = 4; // improved_struts costs 5
    const res = tree.unlock("improved_struts", balance);
    expect(res.success).toBe(false);
    if (res.success) balance -= res.cost;
    expect(balance).toBe(4);
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});

describe("TechTree — serialization", () => {
  it("toJSON returns only unlocked node IDs", () => {
    const tree = new TechTree();
    tree.unlock("fuel_efficiency", 100);
    tree.unlock("data_compression", 100);

    const json = tree.toJSON();
    expect(json).toContain("fuel_efficiency");
    expect(json).toContain("data_compression");
    expect(json).not.toContain("improved_struts");
    expect(json).toHaveLength(2);
  });

  it("restores from serialized unlocked IDs", () => {
    const original = new TechTree();
    original.unlock("improved_struts", 100);
    original.unlock("fuel_efficiency", 100);

    const restored = new TechTree(original.toJSON());
    expect(restored.getNode("improved_struts")?.unlocked).toBe(true);
    expect(restored.getNode("fuel_efficiency")?.unlocked).toBe(true);
    expect(restored.getNode("reinforced_hull")?.unlocked).toBe(false);
  });
});
