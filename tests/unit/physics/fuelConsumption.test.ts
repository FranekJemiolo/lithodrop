/**
 * Fuel consumption unit tests — verify thrust curves and mass influence.
 */

import { describe, it, expect } from "vitest";
import { PAYLOAD_PROFILES, FUEL_CONSUMPTION_RATE } from "../../../src/constants/physics";

describe("Payload profiles", () => {
  it("all expected module types have a defined profile", () => {
    const expectedTypes = [
      "titanium_foundation",
      "solar_array",
      "crew_habitat",
      "fission_reactor",
      "hydroponics_dome",
      "deep_core_drill",
    ];

    for (const type of expectedTypes) {
      expect(PAYLOAD_PROFILES).toHaveProperty(type);
    }
  });

  it("anchor_project is the heaviest module (45,000 kg)", () => {
    const masses = Object.values(PAYLOAD_PROFILES).map((p) => p.mass);
    const maxMass = Math.max(...masses);
    expect(PAYLOAD_PROFILES.anchor_project.mass).toBe(maxMass);
  });

  it("fission_reactor is the heaviest regular module (12,000 kg)", () => {
    const regularModules = Object.entries(PAYLOAD_PROFILES)
      .filter(([key]) => key !== "anchor_project")
      .map(([, p]) => p.mass);
    const maxRegularMass = Math.max(...regularModules);
    expect(PAYLOAD_PROFILES.fission_reactor.mass).toBe(maxRegularMass);
  });

  it("solar_array has the highest drag coefficient (acts like a sail)", () => {
    const drags = Object.values(PAYLOAD_PROFILES).map((p) => p.dragCoefficient);
    const maxDrag = Math.max(...drags);
    expect(PAYLOAD_PROFILES.solar_array.dragCoefficient).toBe(maxDrag);
  });

  it("deep_core_drill has the lowest drag coefficient (aerodynamic dart)", () => {
    const drags = Object.values(PAYLOAD_PROFILES).map((p) => p.dragCoefficient);
    const minDrag = Math.min(...drags);
    expect(PAYLOAD_PROFILES.deep_core_drill.dragCoefficient).toBe(minDrag);
  });

  it("hydroponics_dome has the lowest impact tolerance (fragile)", () => {
    // Exclude shock_absorber_strut which is indestructible (999)
    const tolerances = Object.entries(PAYLOAD_PROFILES)
      .filter(([key]) => key !== "shock_absorber_strut")
      .map(([, p]) => p.impactTolerance);
    const minTolerance = Math.min(...tolerances);
    expect(PAYLOAD_PROFILES.hydroponics_dome.impactTolerance).toBe(minTolerance);
  });

  it("shock_absorber_strut is effectively indestructible", () => {
    expect(PAYLOAD_PROFILES.shock_absorber_strut.impactTolerance).toBeGreaterThan(100);
  });
});

describe("Fuel consumption", () => {
  it("FUEL_CONSUMPTION_RATE is positive", () => {
    expect(FUEL_CONSUMPTION_RATE).toBeGreaterThan(0);
  });

  it("full-throttle burn for 10 seconds consumes expected fuel", () => {
    const consumed = FUEL_CONSUMPTION_RATE * 1.0 * 10; // throttle=1, 10s
    expect(consumed).toBe(400); // 40 kg/s × 10s
  });

  it("half-throttle burn consumes half the fuel", () => {
    const fullThrottle = FUEL_CONSUMPTION_RATE * 1.0 * 10;
    const halfThrottle = FUEL_CONSUMPTION_RATE * 0.5 * 10;
    expect(halfThrottle).toBe(fullThrottle / 2);
  });
});
