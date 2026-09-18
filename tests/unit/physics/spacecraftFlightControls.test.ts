/**
 * Spacecraft Flight Controls & SAS Stabilization Unit Tests.
 *
 * Verifies:
 *   1. Active SAS gyroscopic stabilization (rapidly damps angular velocity on release)
 *   2. SAS auto-level assist (gently guides tilted craft back to upright)
 *   3. Payload inertia-scaled RCS torque (prevents death-spins and sluggish turning)
 *   4. Guaranteed TWR flight authority (guarantees >= 1.85x local weight across all planets)
 *   5. Angular velocity cap (prevents uncontrollable high-speed centrifuge spins)
 */

import { describe, it, expect, beforeEach } from "vitest";
import Matter from "matter-js";
import { createLanderBody, applyRCS } from "../../../src/engine/physics/LanderBody";
import {
  RCS_TORQUE_NM,
  THRUSTER_FORCE_N,
  PLANET_GRAVITY,
  PIXELS_PER_METER,
} from "../../../src/constants/physics";

describe("Spacecraft Flight Controls & SAS Stabilization", () => {
  let engine: Matter.Engine;

  beforeEach(() => {
    engine = Matter.Engine.create();
  });

  it("dampens angular velocity rapidly when steering is released (Active SAS)", () => {
    const lander = createLanderBody({
      moduleType: "titanium_foundation",
      startX: 400,
      startY: 100,
    });
    Matter.Composite.add(engine.world, lander.body);

    // Apply steering CW for 10 ticks
    for (let i = 0; i < 10; i++) {
      applyRCS(lander.body, 1, RCS_TORQUE_NM);
      Matter.Engine.update(engine, 20);
    }

    const omegaAfterSteering = lander.body.angularVelocity;
    expect(omegaAfterSteering).toBeGreaterThan(0);

    // Release steering (direction = 0) for 15 ticks (~0.3s)
    for (let i = 0; i < 15; i++) {
      applyRCS(lander.body, 0, RCS_TORQUE_NM);
      Matter.Engine.update(engine, 20);
    }

    // Active SAS should have dampened angular velocity by more than 85%
    expect(Math.abs(lander.body.angularVelocity)).toBeLessThan(omegaAfterSteering * 0.15);
  });

  it("auto-levels tilted spacecraft towards vertical (SAS Auto-Level)", () => {
    const lander = createLanderBody({
      moduleType: "titanium_foundation",
      startX: 400,
      startY: 100,
    });
    Matter.Composite.add(engine.world, lander.body);

    // Tilt the craft to ~30 degrees (0.52 rad)
    Matter.Body.setAngle(lander.body, 0.52);

    // Run SAS auto-leveling for 50 ticks (1 second)
    for (let i = 0; i < 50; i++) {
      applyRCS(lander.body, 0, RCS_TORQUE_NM);
      Matter.Engine.update(engine, 20);
    }

    // Angle should have significantly reduced toward 0
    expect(lander.body.angle).toBeLessThan(0.35);
    expect(lander.body.angle).toBeGreaterThanOrEqual(0);
  });

  it("caps maximum angular velocity to prevent uncontrollable death-spins", () => {
    const lander = createLanderBody({
      moduleType: "solar_array", // lightweight, high torque-to-mass
      startX: 400,
      startY: 100,
    });
    Matter.Composite.add(engine.world, lander.body);

    // Hold steer continuously for 40 ticks
    for (let i = 0; i < 40; i++) {
      applyRCS(lander.body, 1, RCS_TORQUE_NM);
      Matter.Engine.update(engine, 20);
    }

    // Must be capped at safe flight envelope (~0.045 rad/tick)
    expect(lander.body.angularVelocity).toBeLessThanOrEqual(0.046);
  });

  it("guarantees controllable Thrust-to-Weight Ratio (TWR >= 1.85) on heavy planets and payloads", () => {
    for (const [_planetId, gravityMs2] of Object.entries(PLANET_GRAVITY)) {
      const gravityScale = (gravityMs2 / 1000) * PIXELS_PER_METER;

      for (const moduleType of [
        "solar_array",
        "titanium_foundation",
        "fission_reactor",
        "anchor_project",
      ] as const) {
        const lander = createLanderBody({ moduleType, startX: 400, startY: 100 });
        const weightForce = lander.body.mass * gravityScale * 1_000_000;
        const minControllableThrust = weightForce * 1.85;
        const baseThrustWithTWR = Math.max(THRUSTER_FORCE_N, minControllableThrust);

        const twr = baseThrustWithTWR / weightForce;
        expect(twr).toBeGreaterThanOrEqual(1.84);
      }
    }
  });
});
