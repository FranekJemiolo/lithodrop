/**
 * StructuralIntegrity — Cantilever torque and structural collapse calculator.
 *
 * Mathematically calculates bending moments (torque) on cantilevered horizontal
 * structures that lack vertical pillar/ground support beneath them.
 *
 * Physics Principles:
 *   1. Downward gravitational force: F_i = m_i × g (Newtons)
 *   2. Horizontal lever arm: L_i = |qx_i - qx_root| × CELL_WIDTH_METERS
 *   3. Total bending moment (torque): τ_arm = Σ (F_i × L_i) (N·m)
 *   4. Maximum joint moment capacity: τ_max = structuralSupport_tonnes × 1000 × g × CELL_WIDTH_METERS
 *
 * If τ_arm > τ_max, the cantilever joint fails and all unsupported modules
 * along the arm collapse, emitting MODULE_DESTROYED and HULL_DEGRADATION events.
 */

import type { GridState } from "./GridState";
import type { GridCoord, ModuleInstance } from "./types";
import { toGridKey } from "./types";
import { MODULE_REGISTRY } from "./ModuleRegistry";
import { eventBus } from "../events/EventBus";

export const CELL_WIDTH_METERS = 10;
export const DEFAULT_GRAVITY_MS2 = 9.81;

export interface CantileverArm {
  rootCoord: GridCoord;
  rootModule: ModuleInstance;
  direction: -1 | 1; // -1 = extending left, 1 = extending right
  modules: Array<{
    instance: ModuleInstance;
    coord: GridCoord;
    leverArmMeters: number;
    forceN: number;
    torqueNm: number;
  }>;
  totalTorqueNm: number;
  maxTorqueNm: number;
  isOverloaded: boolean;
}

export interface StructuralAuditResult {
  isStable: boolean;
  arms: CantileverArm[];
  collapsedModules: ModuleInstance[];
  totalTorqueNm: number;
}

export class StructuralIntegrity {
  /**
   * Determine whether a cell is vertically supported from below (has a solid path to ground).
   */
  static isVerticallySupported(grid: GridState, coord: GridCoord): boolean {
    const instance = grid.getModule(coord);
    if (!instance) return false;

    // Anchor hub origin is always grounded
    if (coord.qx === 0 && coord.qy === 0) {
      return true;
    }

    // Check module directly beneath
    const belowCoord: GridCoord = { qx: coord.qx, qy: coord.qy + 1 };
    const belowMod = grid.getModule(belowCoord);
    if (!belowMod || belowMod.health <= 0) {
      return false; // No bottom support
    }

    const belowDef = MODULE_REGISTRY[belowMod.type];
    if (belowDef.structuralSupport <= 0 && belowMod.type !== "titanium_foundation") {
      return false;
    }

    return this.isVerticallySupported(grid, belowCoord);
  }

  /**
   * Analyze all horizontal cantilever arms in the grid and calculate their torque.
   */
  static analyze(grid: GridState, gravityMs2 = DEFAULT_GRAVITY_MS2): CantileverArm[] {
    const modules = grid.getAllModules();
    const arms: CantileverArm[] = [];
    const visitedArms = new Set<string>();

    for (const mod of modules) {
      const coord: GridCoord = { qx: mod.qx, qy: mod.qy };
      const isSupported = this.isVerticallySupported(grid, coord);

      if (!isSupported) continue; // Only vertically supported modules can serve as cantilever roots

      const rootDef = MODULE_REGISTRY[mod.type];
      const supportTonnes = rootDef.structuralSupport ?? 0;
      // Maximum joint bending moment capacity
      const maxTorqueNm = supportTonnes * 1000 * gravityMs2 * CELL_WIDTH_METERS;

      // Scan left (-1) and right (+1)
      for (const dir of [-1, 1] as const) {
        const armKey = `${coord.qx},${coord.qy},${dir}`;
        if (visitedArms.has(armKey)) continue;
        visitedArms.add(armKey);

        const armModules: CantileverArm["modules"] = [];
        let totalTorqueNm = 0;
        let step = 1;

        while (true) {
          const checkCoord: GridCoord = { qx: coord.qx + dir * step, qy: coord.qy };
          const armMod = grid.getModule(checkCoord);
          if (!armMod) break;

          // If this module has vertical support beneath it, it is a pillar, not a cantilever
          if (this.isVerticallySupported(grid, checkCoord)) {
            break;
          }

          const modDef = MODULE_REGISTRY[armMod.type];
          const massKg = modDef?.mass ?? 1000;
          const leverArmMeters = step * CELL_WIDTH_METERS;
          const forceN = massKg * gravityMs2;
          const torqueNm = forceN * leverArmMeters;

          totalTorqueNm += torqueNm;

          armModules.push({
            instance: armMod,
            coord: checkCoord,
            leverArmMeters,
            forceN,
            torqueNm,
          });

          step++;
        }

        if (armModules.length > 0) {
          arms.push({
            rootCoord: coord,
            rootModule: mod,
            direction: dir,
            modules: armModules,
            totalTorqueNm,
            maxTorqueNm,
            isOverloaded: totalTorqueNm > maxTorqueNm,
          });
        }
      }
    }

    return arms;
  }

  /**
   * Evaluates structural integrity, collapses any overloaded cantilever arms,
   * and emits destruction events.
   */
  static evaluateAndEnforce(
    grid: GridState,
    gravityMs2 = DEFAULT_GRAVITY_MS2,
  ): StructuralAuditResult {
    const arms = this.analyze(grid, gravityMs2);
    const collapsedModules: ModuleInstance[] = [];
    const collapsedKeys = new Set<string>();

    for (const arm of arms) {
      if (!arm.isOverloaded) continue;

      // Collapse all modules along the overloaded cantilever arm
      for (const item of arm.modules) {
        const key = toGridKey(item.coord);
        if (collapsedKeys.has(key)) continue;
        collapsedKeys.add(key);

        const removed = grid.removeModule(item.coord);
        if (removed) {
          collapsedModules.push(removed);

          eventBus.emit("HULL_DEGRADATION", {
            instanceId: removed.instanceId,
            moduleType: removed.type,
            damage: 100,
            health: 0,
            severity: 10,
            source: "structural",
          });

          eventBus.emit("MODULE_DESTROYED", {
            instanceId: removed.instanceId,
            moduleType: removed.type,
            qx: removed.qx,
            qy: removed.qy,
          });
        }
      }
    }

    const totalTorqueNm = arms.reduce((sum, a) => sum + a.totalTorqueNm, 0);

    return {
      isStable: collapsedModules.length === 0,
      arms,
      collapsedModules,
      totalTorqueNm,
    };
  }
}
