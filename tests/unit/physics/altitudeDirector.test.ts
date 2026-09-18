/**
 * Unit tests for Altitude Director, Ground Intercept, and Terrain Distance Calculations.
 */

import { describe, it, expect } from "vitest";
import { getTerrainHeightAtX } from "../../../src/engine/physics/TerrainBody";

describe("Altitude Director & Terrain Distance Calculations", () => {
  it("interpolates terrain surface height smoothly between sample points", () => {
    // Heightmap with 3 points: [500, 600, 550], step = 100
    const heightmap = [500, 600, 550];
    const sampleStep = 100;
    const defaultSurfaceY = 500;

    // At x = 0 (exact index 0)
    expect(getTerrainHeightAtX(heightmap, sampleStep, 0, defaultSurfaceY)).toBe(500);

    // At x = 50 (midway between 500 and 600)
    expect(getTerrainHeightAtX(heightmap, sampleStep, 50, defaultSurfaceY)).toBe(550);

    // At x = 100 (exact index 1)
    expect(getTerrainHeightAtX(heightmap, sampleStep, 100, defaultSurfaceY)).toBe(600);

    // At x = 150 (midway between 600 and 550)
    expect(getTerrainHeightAtX(heightmap, sampleStep, 150, defaultSurfaceY)).toBe(575);

    // Out of bounds (negative x clamps to first sample)
    expect(getTerrainHeightAtX(heightmap, sampleStep, -50, defaultSurfaceY)).toBe(500);

    // Out of bounds (positive x clamps to last sample)
    expect(getTerrainHeightAtX(heightmap, sampleStep, 350, defaultSurfaceY)).toBe(550);
  });

  it("handles undefined or empty heightmaps gracefully by returning baseline surfaceY", () => {
    expect(getTerrainHeightAtX(undefined, 100, 250, 520)).toBe(520);
    expect(getTerrainHeightAtX([], 100, 250, 520)).toBe(520);
    expect(getTerrainHeightAtX([500], 0, 250, 520)).toBe(520);
  });

  it("calculates realistic altitude distance in meters (1px = 0.5m)", () => {
    const heightmap = [700, 700, 700];
    const sampleStep = 100;
    const landerY = 300;
    const groundY = getTerrainHeightAtX(heightmap, sampleStep, 150, 700);

    const altitudePx = groundY - landerY; // 400px
    const altitudeMeters = Math.round(altitudePx / 2); // 200m

    expect(altitudePx).toBe(400);
    expect(altitudeMeters).toBe(200);
  });
});
