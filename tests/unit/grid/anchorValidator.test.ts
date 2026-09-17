import { describe, it, expect, beforeEach } from "vitest";
import { GridState } from "../../../src/engine/grid/GridState";
import { AnchorValidator } from "../../../src/engine/grid/AnchorValidator";
import type { ResourceFlowSummary } from "../../../src/engine/grid/types";
import { eventBus } from "../../../src/engine/events/EventBus";

describe("Milestone 8: Anchor Project & Win Condition Validator", () => {
  let grid: GridState;

  const mockFlowSummary = (powerGen = 500, powerCons = 100): ResourceFlowSummary => ({
    powerGenerated: powerGen,
    powerConsumed: powerCons,
    waterGenerated: 0,
    waterConsumed: 0,
    mineralsPerSecond: 0,
    dataPerSecond: 0,
    foodPerSecond: 0,
  });

  beforeEach(() => {
    eventBus.clearAll();
    grid = new GridState();
  });

  it("fails validation if grid lacks sufficient flat foundation modules beneath footprint", () => {
    // Empty grid at origin (0, 0)
    const result = AnchorValidator.validate(grid, mockFlowSummary(400), { qx: 0, qy: 0 });

    expect(result.valid).toBe(false);
    expect(result.hasSufficientSpace).toBe(false);
    // Requires foundations at (0, 1), (1, 1), (2, 1)
    expect(result.missingFoundationCoords).toHaveLength(3);
    expect(result.reason).toContain("Missing flat foundation");
  });

  it("fails validation if foundation is incomplete or broken across the multi-tile span", () => {
    // Only 2 of the 3 required foundation blocks are placed
    grid.placeModule({ qx: 0, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 1 }, "titanium_foundation");
    // Missing (2, 1)

    const result = AnchorValidator.validate(grid, mockFlowSummary(400), { qx: 0, qy: 0 });

    expect(result.valid).toBe(false);
    expect(result.hasSufficientSpace).toBe(false);
    expect(result.missingFoundationCoords).toEqual([{ qx: 2, qy: 1 }]);
  });

  it("fails validation if footprint cells are obstructed by existing non-anchor modules", () => {
    // Place 3 foundations underneath
    grid.placeModule({ qx: 0, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 2, qy: 1 }, "titanium_foundation");

    // Obstruct cell (1, 0) with a solar array
    grid.placeModule({ qx: 1, qy: 0 }, "solar_array");

    const result = AnchorValidator.validate(grid, mockFlowSummary(400), { qx: 0, qy: 0 });

    expect(result.valid).toBe(false);
    expect(result.hasSufficientSpace).toBe(false);
    expect(result.conflictingCoords).toEqual([{ qx: 1, qy: 0 }]);
    expect(result.reason).toContain("Footprint obstructed");
  });

  it("fails validation if colony power capacity does not meet minimum requirement", () => {
    // Place all 3 foundations
    grid.placeModule({ qx: 0, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 2, qy: 1 }, "titanium_foundation");

    // Power generated is only 150 kW, whereas default required is 300 kW
    const lowPowerSummary = mockFlowSummary(150, 50);
    const result = AnchorValidator.validate(grid, lowPowerSummary, { qx: 0, qy: 0 });

    expect(result.valid).toBe(false);
    expect(result.hasSufficientSpace).toBe(true);
    expect(result.hasSufficientPower).toBe(false);
    expect(result.missingPower).toBe(150);
    expect(result.reason).toContain("Insufficient power capacity");
  });

  it("passes validation when flat space and power capacity are both fully satisfied", () => {
    // 3 contiguous titanium foundations
    grid.placeModule({ qx: 0, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 2, qy: 1 }, "titanium_foundation");

    // 400 kW generated (requirement is 300 kW)
    const validSummary = mockFlowSummary(400, 100);
    const result = AnchorValidator.validate(grid, validSummary, { qx: 0, qy: 0 });

    expect(result.valid).toBe(true);
    expect(result.hasSufficientSpace).toBe(true);
    expect(result.hasSufficientPower).toBe(true);
    expect(result.missingPower).toBe(0);
    expect(result.conflictingCoords).toHaveLength(0);
    expect(result.missingFoundationCoords).toHaveLength(0);
  });

  it("placeAnchor places multi-tile modules and triggers ANCHOR_AUTHORIZED and VICTORY", () => {
    grid.placeModule({ qx: 0, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 1 }, "titanium_foundation");
    grid.placeModule({ qx: 2, qy: 1 }, "titanium_foundation");

    let anchorAuthorized = false;
    let victoryEmitted = false;
    eventBus.on("ANCHOR_AUTHORIZED", () => {
      anchorAuthorized = true;
    });
    eventBus.on("VICTORY", () => {
      victoryEmitted = true;
    });

    const placement = AnchorValidator.placeAnchor(grid, mockFlowSummary(500), { qx: 0, qy: 0 });

    expect(placement.success).toBe(true);
    expect(placement.placedModules).toHaveLength(3);
    expect(grid.getModule({ qx: 0, qy: 0 })?.type).toBe("anchor_project");
    expect(grid.getModule({ qx: 1, qy: 0 })?.type).toBe("anchor_project");
    expect(grid.getModule({ qx: 2, qy: 0 })?.type).toBe("anchor_project");
    expect(anchorAuthorized).toBe(true);
    expect(victoryEmitted).toBe(true);
  });
});
