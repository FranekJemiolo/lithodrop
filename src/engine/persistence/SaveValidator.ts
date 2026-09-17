/**
 * SaveValidator — Robust JSON schema validation for LithoDrop save files.
 *
 * Verifies that save files meet structural and value constraints:
 *   1. Rejects corrupted, truncated, or non-JSON payloads without crashing.
 *   2. Enforces positive/non-negative economy numbers (credits, research data, tax tier).
 *   3. Enforces valid array types for grid modules, coordinates, and health ranges [0–100].
 *   4. Verifies unlocked tech nodes and campaign progress schemas.
 *   5. Provides safe fallback default state generation.
 */

import { MODULE_REGISTRY } from "../grid/ModuleRegistry";
import type { SaveSlot, SaveState } from "./SaveManager";

export interface ValidationResult {
  valid: boolean;
  state: SaveState | null;
  errors: string[];
}

export class SaveValidator {
  /**
   * Safely parses and validates raw JSON string into a SaveState.
   * Never throws; handles JSON parse errors gracefully.
   */
  static parseAndValidate(rawJson: string): ValidationResult {
    if (!rawJson || typeof rawJson !== "string") {
      return {
        valid: false,
        state: null,
        errors: ["Input must be a non-empty string."],
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      return {
        valid: false,
        state: null,
        errors: [`JSON parse error: ${err instanceof Error ? err.message : String(err)}`],
      };
    }

    return this.validate(parsed);
  }

  /**
   * Validates a parsed JavaScript object against the SaveState schema.
   */
  static validate(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        valid: false,
        state: null,
        errors: ["Save payload must be a non-null object."],
      };
    }

    const obj = data as Record<string, unknown>;

    // 1. Version
    if (typeof obj.version !== "number" || obj.version < 1) {
      errors.push("Invalid or missing 'version' (must be number >= 1).");
    }

    // 2. Slot
    if (obj.slot !== 0 && obj.slot !== 1 && obj.slot !== 2) {
      errors.push("Invalid or missing 'slot' (must be 0, 1, or 2).");
    }

    // 3. Planet ID
    if (typeof obj.planetId !== "string" || obj.planetId.trim() === "") {
      errors.push("Invalid or missing 'planetId' (must be a non-empty string).");
    }

    // 4. Credits & Economy
    if (typeof obj.credits !== "number" || !Number.isFinite(obj.credits) || obj.credits < 0) {
      errors.push("Invalid 'credits' (must be a finite, non-negative number).");
    }

    if (
      typeof obj.taxTier !== "number" ||
      !Number.isFinite(obj.taxTier) ||
      obj.taxTier < 0 ||
      !Number.isInteger(obj.taxTier)
    ) {
      errors.push("Invalid 'taxTier' (must be a non-negative integer).");
    }

    if (
      obj.researchData !== undefined &&
      (typeof obj.researchData !== "number" ||
        !Number.isFinite(obj.researchData) ||
        obj.researchData < 0)
    ) {
      errors.push("Invalid 'researchData' (must be a finite, non-negative number).");
    }

    // 5. Grid modules
    if (!Array.isArray(obj.grid)) {
      errors.push("Invalid 'grid' property (must be an array).");
    } else {
      for (let i = 0; i < obj.grid.length; i++) {
        const item = obj.grid[i];
        if (!item || typeof item !== "object") {
          errors.push(`Grid module at index ${i} is not an object.`);
          continue;
        }

        const m = item as Record<string, unknown>;
        if (typeof m.qx !== "number" || !Number.isFinite(m.qx)) {
          errors.push(`Grid module at index ${i} has invalid 'qx'.`);
        }
        if (typeof m.qy !== "number" || !Number.isFinite(m.qy)) {
          errors.push(`Grid module at index ${i} has invalid 'qy'.`);
        }
        if (typeof m.type !== "string" || !(m.type in MODULE_REGISTRY)) {
          errors.push(`Grid module at index ${i} has unknown type "${String(m.type)}".`);
        }
        if (
          typeof m.health !== "number" ||
          !Number.isFinite(m.health) ||
          m.health < 0 ||
          m.health > 100
        ) {
          errors.push(`Grid module at index ${i} has invalid 'health' (must be 0–100).`);
        }
        if (typeof m.is_active !== "boolean") {
          errors.push(`Grid module at index ${i} has invalid 'is_active' (must be boolean).`);
        }
      }
    }

    // 6. Tech Tree Nodes
    if (!Array.isArray(obj.unlockedTechNodes)) {
      errors.push("Invalid 'unlockedTechNodes' (must be an array).");
    } else {
      for (let i = 0; i < obj.unlockedTechNodes.length; i++) {
        if (typeof obj.unlockedTechNodes[i] !== "string") {
          errors.push(`Tech node at index ${i} is not a string.`);
        }
      }
    }

    // 7. Campaign progress
    if (!obj.campaignProgress || typeof obj.campaignProgress !== "object") {
      errors.push("Invalid 'campaignProgress' (must be an object).");
    } else {
      const camp = obj.campaignProgress as Record<string, unknown>;
      if (!Array.isArray(camp.completedPlanetIds)) {
        errors.push("Invalid 'campaignProgress.completedPlanetIds' (must be an array).");
      }
      if (typeof camp.anchorProjectActive !== "boolean") {
        errors.push("Invalid 'campaignProgress.anchorProjectActive' (must be a boolean).");
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        state: null,
        errors,
      };
    }

    return {
      valid: true,
      state: data as SaveState,
      errors: [],
    };
  }

  /**
   * Generates a clean default SaveState for a given slot.
   */
  static createDefault(slot: SaveSlot, planetId = "luna_prime"): SaveState {
    return {
      version: 1,
      slot,
      savedAt: Date.now(),
      planetId,
      playTimeSeconds: 0,
      credits: 2000,
      taxTier: 0,
      researchData: 0,
      grid: [
        {
          qx: 0,
          qy: 0,
          type: "titanium_foundation",
          health: 100,
          is_active: true,
          metadata: {},
        },
      ],
      unlockedTechNodes: [],
      campaignProgress: {
        completedPlanetIds: [],
        anchorProjectActive: false,
      },
    };
  }

  /**
   * Safe parser that validates data and falls back to a clean default state
   * instead of throwing or returning null.
   */
  static safeParseWithFallback(data: unknown, fallbackSlot: SaveSlot = 0): SaveState {
    const res = typeof data === "string" ? this.parseAndValidate(data) : this.validate(data);

    if (res.valid && res.state) {
      return res.state;
    }

    console.warn("SaveValidator: Corrupted save detected, using clean fallback:", res.errors);
    return this.createDefault(fallbackSlot);
  }
}
