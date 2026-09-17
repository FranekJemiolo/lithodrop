/**
 * AnchorValidator — Win-condition placement validation for Anchor Projects.
 *
 * Validates that:
 *   1. The base grid has sufficient contiguous flat foundation space (multi-tile footprint).
 *   2. The connected grid network has sufficient sustained power capacity (e.g. 300+ kW).
 *
 * Successful placement authorizes the Anchor Project and triggers the planetary VICTORY state.
 */

import type { GridState } from "./GridState";
import type { GridCoord, ResourceFlowSummary, ModuleInstance } from "./types";
import { eventBus } from "../events/EventBus";
import { MODULE_REGISTRY } from "./ModuleRegistry";

export interface AnchorValidationOptions {
  /** Relative tile offsets for multi-tile footprint. Defaults to 3 horizontal tiles. */
  footprint?: GridCoord[];
  /** Required power capacity (in kW). Defaults to 300. */
  requiredPower?: number;
}

export interface AnchorValidationResult {
  valid: boolean;
  hasSufficientSpace: boolean;
  hasSufficientPower: boolean;
  missingPower: number;
  conflictingCoords: GridCoord[];
  missingFoundationCoords: GridCoord[];
  reason?: string;
}

export interface AnchorPlacementResult {
  success: boolean;
  validation: AnchorValidationResult;
  placedModules?: ModuleInstance[];
}

/** Default 3-tile wide horizontal footprint for the massive Anchor Project */
export const DEFAULT_ANCHOR_FOOTPRINT: GridCoord[] = [
  { qx: 0, qy: 0 },
  { qx: 1, qy: 0 },
  { qx: 2, qy: 0 },
];

export const DEFAULT_REQUIRED_POWER = 300;

export class AnchorValidator {
  /**
   * Validates whether an Anchor Project can be placed at the specified origin coordinate.
   *
   * @param grid - Current colony GridState
   * @param flowSummary - Current ResourceFlowSummary from DependencyGraph
   * @param origin - Top-left origin coordinate of the anchor placement
   * @param options - Custom footprint and power thresholds
   */
  static validate(
    grid: GridState,
    flowSummary: ResourceFlowSummary,
    origin: GridCoord,
    options?: AnchorValidationOptions,
  ): AnchorValidationResult {
    const footprint = options?.footprint ?? DEFAULT_ANCHOR_FOOTPRINT;
    const requiredPower = options?.requiredPower ?? DEFAULT_REQUIRED_POWER;

    const conflictingCoords: GridCoord[] = [];
    const missingFoundationCoords: GridCoord[] = [];

    // 1. Validate space: multi-tile footprint must be empty and supported by flat foundation underneath
    for (const offset of footprint) {
      const cellCoord: GridCoord = {
        qx: origin.qx + offset.qx,
        qy: origin.qy + offset.qy,
      };

      // Check for cell obstruction
      const existing = grid.getModule(cellCoord);
      if (existing && existing.type !== "anchor_project") {
        conflictingCoords.push(cellCoord);
      }

      // Check for solid flat foundation directly beneath
      const foundationCoord: GridCoord = {
        qx: cellCoord.qx,
        qy: cellCoord.qy + 1,
      };
      const foundationMod = grid.getModule(foundationCoord);
      const isSolidFoundation =
        foundationMod &&
        (foundationMod.type === "titanium_foundation" ||
          MODULE_REGISTRY[foundationMod.type]?.function === "structural") &&
        foundationMod.health > 0;

      if (!isSolidFoundation) {
        missingFoundationCoords.push(foundationCoord);
      }
    }

    const hasSufficientSpace =
      conflictingCoords.length === 0 && missingFoundationCoords.length === 0;

    // 2. Validate power capacity
    const hasSufficientPower = flowSummary.powerGenerated >= requiredPower;
    const missingPower = hasSufficientPower ? 0 : requiredPower - flowSummary.powerGenerated;

    let reason: string | undefined;
    if (!hasSufficientSpace) {
      if (conflictingCoords.length > 0) {
        reason = `Footprint obstructed at ${conflictingCoords.map((c) => `(${c.qx},${c.qy})`).join(", ")}`;
      } else {
        reason = `Missing flat foundation support at ${missingFoundationCoords.map((c) => `(${c.qx},${c.qy})`).join(", ")}`;
      }
    } else if (!hasSufficientPower) {
      reason = `Insufficient power capacity: ${flowSummary.powerGenerated} kW generated < ${requiredPower} kW required (deficit: ${missingPower} kW)`;
    }

    return {
      valid: hasSufficientSpace && hasSufficientPower,
      hasSufficientSpace,
      hasSufficientPower,
      missingPower,
      conflictingCoords,
      missingFoundationCoords,
      reason,
    };
  }

  /**
   * Places the Anchor Project on the grid if validation passes.
   * Emits ANCHOR_AUTHORIZED and VICTORY events upon successful placement.
   */
  static placeAnchor(
    grid: GridState,
    flowSummary: ResourceFlowSummary,
    origin: GridCoord,
    options?: AnchorValidationOptions,
  ): AnchorPlacementResult {
    const validation = this.validate(grid, flowSummary, origin, options);
    if (!validation.valid) {
      return { success: false, validation };
    }

    const footprint = options?.footprint ?? DEFAULT_ANCHOR_FOOTPRINT;
    const placedModules: ModuleInstance[] = [];

    // Place main anchor project at origin
    const mainAnchor = grid.placeModule(origin, "anchor_project");
    placedModules.push(mainAnchor);

    // Place subsidiary structural anchor tiles for remaining footprint
    for (let i = 1; i < footprint.length; i++) {
      const cellCoord: GridCoord = {
        qx: origin.qx + footprint[i].qx,
        qy: origin.qy + footprint[i].qy,
      };
      const subAnchor = grid.placeModule(cellCoord, "anchor_project");
      placedModules.push(subAnchor);
    }

    // Trigger win sequence
    eventBus.emit("ANCHOR_AUTHORIZED", {});
    eventBus.emit("VICTORY", {});

    return {
      success: true,
      validation,
      placedModules,
    };
  }
}
