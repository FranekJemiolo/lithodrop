/**
 * HazardSystem — Dynamic Environmental Hazards & Forces for Descent Phase.
 *
 * Simulates 3 planetary atmospheric hazards:
 *   1. Wind Shear (lateral force vector Fx pushing ship horizontally)
 *   2. Thermal Downdraft (vertical convection multiplying gravity Fy)
 *   3. Corrosive Cloud (damage-over-time applied directly to hullHealth)
 *
 * Rules:
 *   - Hitbox geometry aligns 1:1 with HazardRenderer visual indicators
 *   - Corrosive cloud damage-over-time stops applying the exact frame the ship
 *     touches down or exits the cloud boundary.
 */

import Matter from "matter-js";
import type { LanderBodyState } from "./LanderBody";

export type HazardType = "wind_shear" | "thermal_downdraft" | "corrosive_cloud";

export interface HazardBounds {
  x: number; // top-left x in pixels
  y: number; // top-left y in pixels
  width: number;
  height: number;
}

export interface Hazard {
  id: string;
  type: HazardType;
  bounds: HazardBounds;
  /** Lateral wind force in Newtons (positive = right, negative = left) */
  windForceN?: number;
  /** Multiplier for downward gravity (e.g. 2.0 = double gravity) */
  gravityMultiplier?: number;
  /** Damage per second inflicted to hull */
  damagePerSecond?: number;
  /** Active warning intensity [0–1] for visual pulsation */
  warningIntensity: number;
}

export class HazardSystem {
  private hazards: Hazard[] = [];
  private shipInsideCloud = false;

  constructor(planetId: string, screenWidth: number, surfaceY: number) {
    this.generateHazardsForPlanet(planetId, screenWidth, surfaceY);
  }

  private generateHazardsForPlanet(planetId: string, width: number, surfaceY: number): void {
    // Generate deterministic hazards based on planetary profiles
    if (planetId === "serpentine_rifts" || planetId === "thalassa" || planetId === "zephyrus") {
      // Wind Shear band at high-altitude (e.g. 15% to 40% descent altitude)
      this.hazards.push({
        id: "wind_shear_upper",
        type: "wind_shear",
        bounds: {
          x: 0,
          y: surfaceY * 0.15,
          width,
          height: surfaceY * 0.25,
        },
        windForceN: planetId === "zephyrus" ? 140_000 : 70_000,
        warningIntensity: 0.8,
      });
    }

    if (planetId === "zephyrus" || planetId === "vulcanis") {
      // Thermal Downdraft vertical column
      const colWidth = width * 0.28;
      this.hazards.push({
        id: "thermal_downdraft_central",
        type: "thermal_downdraft",
        bounds: {
          x: width * 0.36,
          y: surfaceY * 0.1,
          width: colWidth,
          height: surfaceY * 0.7,
        },
        gravityMultiplier: 2.2,
        warningIntensity: 0.9,
      });
    }

    if (planetId === "the_outer_dark" || planetId === "vulcanis" || planetId === "thalassa") {
      // Corrosive Acid / Dust Cloud volume
      const cloudW = width * 0.32;
      const cloudH = surfaceY * 0.22;
      this.hazards.push({
        id: "corrosive_cloud_pocket",
        type: "corrosive_cloud",
        bounds: {
          x: width * 0.55,
          y: surfaceY * 0.42,
          width: cloudW,
          height: cloudH,
        },
        damagePerSecond: 10, // 10 HP/s
        warningIntensity: 0.85,
      });
    }
  }

  /**
   * Update active forces and DoT damage applied to the lander.
   *
   * @param landerState - Current lander body state
   * @param dtSeconds - Frame delta time in seconds
   * @param landed - Whether lander has touched down
   * @returns Updated lander state with hazard effects applied
   */
  update(
    landerState: LanderBodyState,
    dtSeconds: number,
    landed: boolean,
  ): {
    state: LanderBodyState;
    inWind: boolean;
    inDowndraft: boolean;
    inCorrosiveCloud: boolean;
    corrosiveDamageTaken: number;
  } {
    let inWind = false;
    let inDowndraft = false;
    let inCorrosiveCloud = false;
    let corrosiveDamageTaken = 0;

    // If already landed or dead, all atmospheric hazards immediately cease
    if (landed || !landerState.isAlive) {
      this.shipInsideCloud = false;
      return {
        state: landerState,
        inWind: false,
        inDowndraft: false,
        inCorrosiveCloud: false,
        corrosiveDamageTaken: 0,
      };
    }

    const shipPos = landerState.body.position;

    for (const hazard of this.hazards) {
      const isInside = this.isPointInBounds(shipPos.x, shipPos.y, hazard.bounds);
      if (!isInside) continue;

      switch (hazard.type) {
        case "wind_shear": {
          inWind = true;
          const forceX = (hazard.windForceN ?? 50_000) / 1_000_000;
          Matter.Body.applyForce(landerState.body, shipPos, { x: forceX, y: 0 });
          break;
        }

        case "thermal_downdraft": {
          inDowndraft = true;
          const mult = hazard.gravityMultiplier ?? 2.0;
          // Apply extra downward force proportional to mass and gravity boost
          const extraDownForce = (landerState.body.mass * 9.8 * (mult - 1)) / 1_000_000;
          Matter.Body.applyForce(landerState.body, shipPos, { x: 0, y: extraDownForce });
          break;
        }

        case "corrosive_cloud": {
          inCorrosiveCloud = true;
          const dps = hazard.damagePerSecond ?? 8;
          corrosiveDamageTaken = dps * dtSeconds;
          break;
        }
      }
    }

    this.shipInsideCloud = inCorrosiveCloud;

    // Apply corrosive cloud damage directly to hullHealth
    let updatedState = landerState;
    if (corrosiveDamageTaken > 0) {
      const newHull = Math.max(0, landerState.hullHealth - corrosiveDamageTaken);
      updatedState = {
        ...landerState,
        hullHealth: newHull,
        isAlive: newHull > 0,
      };
    }

    return {
      state: updatedState,
      inWind,
      inDowndraft,
      inCorrosiveCloud,
      corrosiveDamageTaken,
    };
  }

  isPointInBounds(x: number, y: number, b: HazardBounds): boolean {
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  getHazards(): Hazard[] {
    return this.hazards;
  }

  isShipInCloud(): boolean {
    return this.shipInsideCloud;
  }
}
