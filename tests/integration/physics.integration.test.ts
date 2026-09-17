/**
 * Integration test — PhysicsWorld stepping and LanderBody behavior.
 *
 * Tests that the physics engine correctly steps and that the lander body
 * responds to gravity and force application.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PhysicsWorld } from "../../src/engine/physics/PhysicsWorld";
import { createLanderBody, applyThrust, getDownwardVelocity } from "../../src/engine/physics/LanderBody";
import { FUEL_CONSUMPTION_RATE, THRUSTER_FORCE_N } from "../../src/constants/physics";

describe("PhysicsWorld + LanderBody integration", () => {
  let world: PhysicsWorld;

  beforeEach(() => {
    // Luna Prime gravity
    world = new PhysicsWorld(1.62);
  });

  it("creates a lander body without errors for known module types", () => {
    const state = createLanderBody({
      moduleType: "titanium_foundation",
      startX: 400,
      startY: 100,
    });
    expect(state.body).toBeDefined();
    expect(state.fuelKg).toBeGreaterThan(0);
    expect(state.hullHealth).toBe(100);
    expect(state.isAlive).toBe(true);
  });

  it("throws for unknown module types", () => {
    expect(() =>
      createLanderBody({
        moduleType: "nonexistent_module" as never,
        startX: 0,
        startY: 0,
      }),
    ).toThrow();
  });

  it("lander body falls under gravity over time", () => {
    const state = createLanderBody({
      moduleType: "crew_habitat",
      startX: 400,
      startY: 100,
    });
    world.addBody(state.body);

    const initialY = state.body.position.y;

    // Step 500ms of physics
    for (let i = 0; i < 25; i++) {
      world.step(20); // 25 × 20ms = 500ms
    }

    const finalY = state.body.position.y;

    // Under any positive gravity, body should have moved downward (Y increases)
    expect(finalY).toBeGreaterThan(initialY);
  });

  it("thrust reduces fuel over time", () => {
    let state = createLanderBody({
      moduleType: "titanium_foundation",
      startX: 400,
      startY: 100,
    });
    world.addBody(state.body);

    const initialFuel = state.fuelKg;
    const DT_SECONDS = 0.02; // 20ms

    // Apply thrust for 10 steps = 200ms at full throttle
    for (let i = 0; i < 10; i++) {
      state = applyThrust(state, 1.0, THRUSTER_FORCE_N, FUEL_CONSUMPTION_RATE, DT_SECONDS);
    }

    const expectedConsumed = FUEL_CONSUMPTION_RATE * 1.0 * DT_SECONDS * 10;
    expect(state.fuelKg).toBeCloseTo(initialFuel - expectedConsumed, 1);
  });

  it("fuel does not go below 0", () => {
    let state = createLanderBody({
      moduleType: "titanium_foundation",
      startX: 0,
      startY: 0,
    });
    world.addBody(state.body);

    // Apply thrust for a very long time
    for (let i = 0; i < 10000; i++) {
      state = applyThrust(state, 1.0, THRUSTER_FORCE_N, FUEL_CONSUMPTION_RATE, 0.1);
    }

    expect(state.fuelKg).toBeGreaterThanOrEqual(0);
  });

  it("getDownwardVelocity returns 0 for a stationary body", () => {
    const state = createLanderBody({
      moduleType: "titanium_foundation",
      startX: 0,
      startY: 0,
    });
    // Don't add to world — body starts with zero velocity
    const vel = getDownwardVelocity(state.body);
    expect(vel).toBe(0);
  });

  afterEach(() => {
    world.destroy();
  });
});
