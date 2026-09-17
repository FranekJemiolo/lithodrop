/**
 * HazardSystem unit tests — Wind Shear, Thermal Downdrafts, Corrosive Clouds.
 *
 * Verifies:
 *   - Lateral forces applied by Wind Shear
 *   - Gravity force multiplied by Thermal Downdrafts
 *   - Hitbox geometry boundary checks
 *   - Damage-over-time applies inside cloud
 *   - DoT ceases the exact frame the ship exits the cloud or lands
 */

import { describe, it, expect, beforeEach } from "vitest";
import Matter from "matter-js";
import { HazardSystem } from "../../../src/engine/physics/HazardSystem";
import { createLanderBody, type LanderBodyState } from "../../../src/engine/physics/LanderBody";

describe("HazardSystem — Environmental Physics", () => {
  let hazardSystem: HazardSystem;
  let lander: LanderBodyState;

  beforeEach(() => {
    // zephyrus spawns wind_shear and thermal_downdraft; vulcanis spawns downdraft and corrosive_cloud
    hazardSystem = new HazardSystem("zephyrus", 800, 600);
    lander = createLanderBody({
      moduleType: "titanium_foundation",
      startX: 400,
      startY: 100,
    });
  });

  it("generates environmental hazards for the planet", () => {
    const hazards = hazardSystem.getHazards();
    expect(hazards.length).toBeGreaterThanOrEqual(1);
    expect(hazards.some((h) => h.type === "wind_shear")).toBe(true);
    expect(hazards.some((h) => h.type === "thermal_downdraft")).toBe(true);
  });

  it("applies lateral force when inside wind shear zone", () => {
    const windHazard = hazardSystem.getHazards().find((h) => h.type === "wind_shear")!;
    expect(windHazard).toBeDefined();

    // Position lander directly inside wind shear bounds
    Matter.Body.setPosition(lander.body, {
      x: windHazard.bounds.x + 50,
      y: windHazard.bounds.y + 20,
    });

    const initialForceX = lander.body.force.x;
    const res = hazardSystem.update(lander, 0.02, false);

    expect(res.inWind).toBe(true);
    expect(lander.body.force.x).toBeGreaterThan(initialForceX);
  });

  it("multiplies downward gravity when inside thermal downdraft", () => {
    const downdraft = hazardSystem.getHazards().find((h) => h.type === "thermal_downdraft")!;
    expect(downdraft).toBeDefined();

    Matter.Body.setPosition(lander.body, {
      x: downdraft.bounds.x + downdraft.bounds.width / 2,
      y: downdraft.bounds.y + downdraft.bounds.height / 2,
    });

    const initialForceY = lander.body.force.y;
    const res = hazardSystem.update(lander, 0.02, false);

    expect(res.inDowndraft).toBe(true);
    expect(lander.body.force.y).toBeGreaterThan(initialForceY);
  });

  it("applies damage-over-time inside corrosive clouds and reduces hull", () => {
    const acidSys = new HazardSystem("vulcanis", 800, 600);
    const cloud = acidSys.getHazards().find((h) => h.type === "corrosive_cloud")!;
    expect(cloud).toBeDefined();

    Matter.Body.setPosition(lander.body, {
      x: cloud.bounds.x + 20,
      y: cloud.bounds.y + 20,
    });

    const initialHealth = lander.hullHealth;
    const res = acidSys.update(lander, 1.0, false); // 1.0 second inside cloud

    expect(res.inCorrosiveCloud).toBe(true);
    expect(res.corrosiveDamageTaken).toBe(10); // 10 HP/s
    expect(res.state.hullHealth).toBe(initialHealth - 10);
  });

  it("BUG CHECK: stops applying DoT the exact frame the ship exits cloud", () => {
    const acidSys = new HazardSystem("vulcanis", 800, 600);
    const cloud = acidSys.getHazards().find((h) => h.type === "corrosive_cloud")!;

    // Frame 1: Inside cloud
    Matter.Body.setPosition(lander.body, {
      x: cloud.bounds.x + 10,
      y: cloud.bounds.y + 10,
    });
    const res1 = acidSys.update(lander, 0.02, false);
    expect(res1.inCorrosiveCloud).toBe(true);
    expect(res1.corrosiveDamageTaken).toBeGreaterThan(0);

    // Frame 2: Move outside cloud
    Matter.Body.setPosition(lander.body, {
      x: cloud.bounds.x + cloud.bounds.width + 50,
      y: cloud.bounds.y,
    });
    const res2 = acidSys.update(res1.state, 0.02, false);
    expect(res2.inCorrosiveCloud).toBe(false);
    expect(res2.corrosiveDamageTaken).toBe(0);
    expect(res2.state.hullHealth).toBe(res1.state.hullHealth); // No further damage
  });

  it("BUG CHECK: stops applying DoT the exact frame the ship touches down (landed = true)", () => {
    const acidSys = new HazardSystem("vulcanis", 800, 600);
    const cloud = acidSys.getHazards().find((h) => h.type === "corrosive_cloud")!;

    // Even if physically inside coordinates, landed = true immediately cuts off hazard DoT
    Matter.Body.setPosition(lander.body, {
      x: cloud.bounds.x + 10,
      y: cloud.bounds.y + 10,
    });

    const res = acidSys.update(lander, 0.02, true); // landed = true
    expect(res.inCorrosiveCloud).toBe(false);
    expect(res.corrosiveDamageTaken).toBe(0);
    expect(res.state.hullHealth).toBe(lander.hullHealth);
  });
});
