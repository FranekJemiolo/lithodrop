import { describe, it, expect, beforeEach } from "vitest";
import { GridState } from "../../../src/engine/grid/GridState";
import {
  StructuralIntegrity,
  CELL_WIDTH_METERS,
} from "../../../src/engine/grid/StructuralIntegrity";
import { eventBus } from "../../../src/engine/events/EventBus";
import type { ModuleDestroyedPayload } from "../../../src/engine/events/EventTypes";

describe("Phase 1: Cantilever Torque & Structural Integrity Audit", () => {
  let grid: GridState;

  beforeEach(() => {
    eventBus.clearAll();
    grid = new GridState();
  });

  it("considers vertically grounded pillars stable with no cantilever torque", () => {
    // Foundation at (0, 0)
    grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    // Habitat stacked directly above at (0, -1)
    grid.placeModule({ qx: 0, qy: -1 }, "crew_habitat");
    // Solar array stacked directly above at (0, -2)
    grid.placeModule({ qx: 0, qy: -2 }, "solar_array");

    const arms = StructuralIntegrity.analyze(grid, 9.81);
    expect(arms).toHaveLength(0);

    const audit = StructuralIntegrity.evaluateAndEnforce(grid, 9.81);
    expect(audit.isStable).toBe(true);
    expect(audit.collapsedModules).toHaveLength(0);
    expect(grid.size).toBe(3);
  });

  it("calculates torque on a single horizontal cantilever arm accurately (τ = m × g × L)", () => {
    // Solid foundation root at (0, 0)
    grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");

    // Unsupported solar array extending right to (1, 0)
    // solar_array mass = 1200 kg
    grid.placeModule({ qx: 1, qy: 0 }, "solar_array");

    const gravity = 9.81;
    const arms = StructuralIntegrity.analyze(grid, gravity);
    expect(arms).toHaveLength(1);

    const arm = arms[0];
    expect(arm.rootCoord).toEqual({ qx: 0, qy: 0 });
    expect(arm.direction).toBe(1);
    expect(arm.modules).toHaveLength(1);

    // Expected torque: 1200 kg × 9.81 m/s² × 10m = 117,720 N·m
    const expectedTorque = 1200 * gravity * CELL_WIDTH_METERS;
    expect(arm.totalTorqueNm).toBeCloseTo(expectedTorque, 2);
    expect(arm.isOverloaded).toBe(false); // Foundation has 80 tonnes capacity (>> 1200kg)
  });

  it("causes structural collapse when cantilever torque exceeds joint capacity", () => {
    // Science lab at (0, 0) has only 5 tonnes structural support capacity
    grid.placeModule({ qx: 0, qy: 0 }, "science_lab");

    // Hang an extremely heavy Fission Reactor (12,000 kg) 2 cells out at (2, 0)
    // Plus a heavy Deep Core Drill (5,500 kg) at (1, 0)
    grid.placeModule({ qx: 1, qy: 0 }, "deep_core_drill");
    grid.placeModule({ qx: 2, qy: 0 }, "fission_reactor");

    const destroyedEvents: ModuleDestroyedPayload[] = [];
    eventBus.on("MODULE_DESTROYED", (ev) => {
      destroyedEvents.push(ev);
    });

    const audit = StructuralIntegrity.evaluateAndEnforce(grid, 9.81);

    // 5 tonnes support capacity = 5 * 1000 * 9.81 * 10 = 490,500 N·m
    // Actual torque = (5500 * 9.81 * 10) + (12000 * 9.81 * 20) = 539,550 + 2,354,400 = 2,893,950 N·m (overloaded!)
    expect(audit.isStable).toBe(false);
    expect(audit.collapsedModules).toHaveLength(2);
    expect(destroyedEvents).toHaveLength(2);

    // Overloaded cantilever modules removed from grid
    expect(grid.getModule({ qx: 1, qy: 0 })).toBeNull();
    expect(grid.getModule({ qx: 2, qy: 0 })).toBeNull();
    // Root module remains intact
    expect(grid.getModule({ qx: 0, qy: 0 })).not.toBeNull();
  });

  it("prevents non-structural modules (0 tonnes capacity) from supporting cantilevers", () => {
    // Solar array has 0 structural support
    grid.placeModule({ qx: 0, qy: 0 }, "solar_array");
    // Hanging another module horizontally off the solar array
    grid.placeModule({ qx: 1, qy: 0 }, "hydroponics_dome");

    const arms = StructuralIntegrity.analyze(grid, 9.81);
    // Since root has 0 support, maxTorqueNm is 0
    expect(arms[0].maxTorqueNm).toBe(0);
    expect(arms[0].isOverloaded).toBe(true);

    const audit = StructuralIntegrity.evaluateAndEnforce(grid, 9.81);
    expect(audit.isStable).toBe(false);
    expect(grid.getModule({ qx: 1, qy: 0 })).toBeNull();
  });

  it("scales cantilever torque with planetary gravity", () => {
    grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    grid.placeModule({ qx: 1, qy: 0 }, "crew_habitat"); // 3200 kg

    // Luna Prime: 1.62 m/s²
    const lunaArms = StructuralIntegrity.analyze(grid, 1.62);
    const lunaTorque = 3200 * 1.62 * CELL_WIDTH_METERS;
    expect(lunaArms[0].totalTorqueNm).toBeCloseTo(lunaTorque, 2);

    // Zephyrus: 24.8 m/s²
    const zephyrusArms = StructuralIntegrity.analyze(grid, 24.8);
    const zephyrusTorque = 3200 * 24.8 * CELL_WIDTH_METERS;
    expect(zephyrusArms[0].totalTorqueNm).toBeCloseTo(zephyrusTorque, 2);

    expect(zephyrusArms[0].totalTorqueNm).toBeGreaterThan(lunaArms[0].totalTorqueNm * 10);
  });
});
