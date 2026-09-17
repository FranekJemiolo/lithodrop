/**
 * BuildPhaseSystem — Grid placement, economy tick, and drop-bounty integration.
 *
 * Orchestrates the Build Phase game loop:
 *   1. Receives PAYLOAD_TOUCHDOWN events to trigger module placement
 *   2. Runs EconomyEngine tick each frame
 *   3. Manages DependencyGraph rebuilds on grid mutations
 *   4. Manages DroneDispatchQueue (auto-repair)
 *   5. Checks win condition (ANCHOR_AUTHORIZED + victory emission)
 *
 * The PixiJS BuildScene owns the visual rendering; this system owns the data.
 */

import type { Ticker } from "pixi.js";
import { GridState } from "../grid/GridState";
import { DependencyGraph } from "../grid/DependencyGraph";
import { EconomyEngine } from "../economy/EconomyEngine";
import { DroneDispatchQueue } from "../events/DroneDispatchQueue";
import { eventBus } from "../events/EventBus";
import type { ModuleType } from "../grid/types";
import { calculateDropBounty } from "../../constants/physics";
import { getModuleDef } from "../grid/ModuleRegistry";
import type { PlanetDefinition } from "../../constants/planets";

export class BuildPhaseSystem {
  readonly grid: GridState;
  readonly graph: DependencyGraph;
  readonly economy: EconomyEngine;
  readonly droneQueue: DroneDispatchQueue;

  private victoryEmitted = false;

  private readonly unsubTouchdown: () => void;
  private readonly unsubAnchorAuth: () => void;

  constructor(planet: PlanetDefinition) {

    this.grid = new GridState();
    this.graph = new DependencyGraph();
    this.economy = new EconomyEngine({
      initialCredits: 2000,
      quotaCreditsPerSecond: planet.quotaCreditsPerSecond,
      quotaSustainMs: planet.quotaSustainSeconds * 1000,
    });
    this.droneQueue = new DroneDispatchQueue(3);

    // Auto-place anchor foundation at (0, 0) — the hub
    this.grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");

    // Listen for payload touchdown to award bounty and place module
    this.unsubTouchdown = eventBus.on("PAYLOAD_TOUCHDOWN", (ev) => {
      if (!ev.survived) return;

      // Award drop bounty
      const def = getModuleDef(ev.moduleType);
      const bounty = calculateDropBounty({
        baseCost: def.baseCost,
        maxDescentVelocity: 30, // rough estimate until M4 passes actual value
        fuelRemaining: ev.fuelRemaining,
        impactVelocity: ev.velocity,
        impactTolerance: def.impactTolerance,
      });
      this.economy.addCredits(bounty);

      // Place module adjacent to existing structure
      const coord = this.findNextOpenSlot();
      if (coord) {
        const instance = this.grid.placeModule(coord, ev.moduleType);
        eventBus.emit("MODULE_SNAPPED", {
          instanceId: instance.instanceId,
          moduleType: ev.moduleType,
          qx: coord.qx,
          qy: coord.qy,
        });
      }
    });

    // Victory condition: Anchor authorized
    this.unsubAnchorAuth = eventBus.on("ANCHOR_AUTHORIZED", () => {
      if (!this.victoryEmitted) {
        this.victoryEmitted = true;
        // Small delay for dramatic effect
        setTimeout(() => {
          eventBus.emit("VICTORY", {});
        }, 3000);
      }
    });
  }

  /** Called from PixiJS ticker each frame */
  update(ticker: Ticker): void {
    this.economy.tick(ticker.deltaMS, this.graph, this.grid);
  }

  /**
   * Manually place a module (from Module Dock UI drag-and-drop).
   * Returns false if placement is invalid or player can't afford it.
   */
  placeModule(qx: number, qy: number, type: ModuleType): boolean {
    const coord = { qx, qy };
    if (this.grid.isOccupied(coord)) return false;

    const def = getModuleDef(type);
    if (!this.economy.spendCredits(def.baseCost)) return false;

    const instance = this.grid.placeModule(coord, type);
    eventBus.emit("MODULE_SNAPPED", {
      instanceId: instance.instanceId,
      moduleType: type,
      qx,
      qy,
    });

    return true;
  }

  /**
   * Find the next open slot adjacent to any existing module.
   * Simple BFS from (0,0) outward — returns first open neighbor.
   */
  private findNextOpenSlot(): { qx: number; qy: number } | null {
    const visited = new Set<string>();
    const queue: { qx: number; qy: number }[] = [{ qx: 0, qy: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.qx},${current.qy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const neighbors = [
        { qx: current.qx + 1, qy: current.qy },
        { qx: current.qx - 1, qy: current.qy },
        { qx: current.qx, qy: current.qy + 1 },
        { qx: current.qx, qy: current.qy - 1 },
      ];

      for (const n of neighbors) {
        if (!this.grid.isOccupied(n)) return n;
        queue.push(n);
      }
    }

    return null; // Grid fully occupied (very unlikely)
  }

  destroy(): void {
    this.unsubTouchdown();
    this.unsubAnchorAuth();
    this.droneQueue.destroy();
  }
}
