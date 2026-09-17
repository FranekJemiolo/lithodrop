/**
 * Impact threshold tests — verify the damage calculation formula.
 */

import { describe, it, expect } from "vitest";
import { calculateImpactDamage, calculateDropBounty } from "../../../src/constants/physics";

describe("calculateImpactDamage", () => {
  it("returns 0 damage for velocity at or below tolerance", () => {
    expect(calculateImpactDamage(5.0, 5.0)).toBe(0);
    expect(calculateImpactDamage(3.0, 5.0)).toBe(0);
    expect(calculateImpactDamage(0, 5.0)).toBe(0);
  });

  it("returns 100% damage when velocity is double the tolerance", () => {
    // (10 - 5) / 5 × 100 = 100
    expect(calculateImpactDamage(10.0, 5.0)).toBe(100);
  });

  it("returns partial damage for moderate overspeed", () => {
    // Titanium Foundation: tolerance 12 m/s, impact at 14 m/s
    // (14 - 12) / 12 × 100 = 16.67
    const damage = calculateImpactDamage(14, 12);
    expect(damage).toBeCloseTo(16.67, 1);
  });

  it("clamps damage at 100% for extreme velocities", () => {
    expect(calculateImpactDamage(100, 5)).toBe(100);
  });

  it("hydroponics dome shatters at 5 m/s (tolerance 2.5 m/s)", () => {
    // (5 - 2.5) / 2.5 × 100 = 100%
    const damage = calculateImpactDamage(5, 2.5);
    expect(damage).toBe(100); // destroyed
  });

  it("hydroponics dome survives at 2 m/s", () => {
    const damage = calculateImpactDamage(2, 2.5);
    expect(damage).toBe(0); // perfect landing
  });
});

describe("calculateDropBounty", () => {
  const baseParams = {
    baseCost: 1000,
    maxDescentVelocity: 30,
    fuelRemaining: 0.5,
    impactVelocity: 3,
    impactTolerance: 5,
  };

  it("returns a positive bounty for valid parameters", () => {
    const bounty = calculateDropBounty(baseParams);
    expect(bounty).toBeGreaterThan(0);
  });

  it("higher descent velocity increases bounty (up to 2×)", () => {
    const slow = calculateDropBounty({ ...baseParams, maxDescentVelocity: 10 });
    const fast = calculateDropBounty({ ...baseParams, maxDescentVelocity: 60 });
    expect(fast).toBeGreaterThan(slow);
  });

  it("more remaining fuel increases bounty", () => {
    const empty = calculateDropBounty({ ...baseParams, fuelRemaining: 0 });
    const full = calculateDropBounty({ ...baseParams, fuelRemaining: 1 });
    expect(full).toBeGreaterThan(empty);
  });

  it("softer landing increases bounty", () => {
    const hard = calculateDropBounty({ ...baseParams, impactVelocity: 4.9 });
    const soft = calculateDropBounty({ ...baseParams, impactVelocity: 0.1 });
    expect(soft).toBeGreaterThan(hard);
  });

  it("maximum bounty is roughly 3.9× base bounty", () => {
    const maxBounty = calculateDropBounty({
      baseCost: 1000,
      maxDescentVelocity: 100, // capped at 2×
      fuelRemaining: 1.0,
      impactVelocity: 0,
      impactTolerance: 5,
    });
    // baseBounty = 150: 150 × 2 × 1.3 × 1.5 = 585 (theoretical max)
    expect(maxBounty).toBeLessThanOrEqual(600);
    expect(maxBounty).toBeGreaterThan(400);
  });
});
