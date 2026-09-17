/**
 * PlanetSelection unit tests — verifies all 6 planetary sector definitions, physics properties, and prerequisites.
 */

import { describe, it, expect } from "vitest";
import { PLANETS, getPlanetById } from "../../../src/constants/planets";

describe("Planetary Campaign System", () => {
  it("contains all 6 required planetary sectors", () => {
    expect(PLANETS.length).toBe(6);
    const ids = PLANETS.map((p) => p.id);
    expect(ids).toEqual([
      "luna_prime",
      "serpentine_rifts",
      "thalassa",
      "zephyrus",
      "the_outer_dark",
      "vulcanis",
    ]);
  });

  it("defines unique environmental properties for each planet", () => {
    for (const planet of PLANETS) {
      expect(planet.displayName).toBeTruthy();
      expect(planet.gravityMs2).toBeGreaterThan(0);
      expect(planet.atmosphereDensity).toBeGreaterThanOrEqual(0);
      expect(planet.quotaCreditsPerSecond).toBeGreaterThan(0);
      expect(planet.anchorProject).toBeDefined();
      expect(planet.anchorProject.displayName).toBeTruthy();
      expect(planet.hazards.length).toBeGreaterThan(0);
    }
  });

  it("establishes valid campaign prerequisite chain", () => {
    expect(PLANETS[0].prerequisitePlanetId).toBeNull();
    for (let i = 1; i < PLANETS.length; i++) {
      expect(PLANETS[i].prerequisitePlanetId).toBe(PLANETS[i - 1].id);
    }
  });

  it("retrieves planets correctly by id", () => {
    const luna = getPlanetById("luna_prime");
    expect(luna.displayName).toBe("Luna Prime");
    expect(luna.gravityMs2).toBe(1.62);

    const zephyrus = getPlanetById("zephyrus");
    expect(zephyrus.displayName).toBe("Zephyrus");
    expect(zephyrus.gravityMs2).toBe(18.0);
  });
});
