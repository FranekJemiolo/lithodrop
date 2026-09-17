/**
 * GridState — Sparse coordinate map of all placed colony modules.
 *
 * The grid uses integer (qx, qy) coordinates stored in a Map keyed by
 * "qx,qy" strings. This keeps save payloads tiny (200 modules = ~8KB)
 * and lookups O(1).
 *
 * GridState is purely data — no PixiJS or React imports.
 * All mutations emit events via EventBus after the fact.
 */

import {
  type GridCoord,
  type GridKey,
  type ModuleInstance,
  type ModuleType,
  toGridKey,
  fromGridKey,
  getNeighborCoords,
} from "./types";

export class GridState {
  private readonly cells = new Map<GridKey, ModuleInstance>();
  private nextInstanceId = 1;

  /** Place a new module at the given grid coordinate. Returns the instance. */
  placeModule(coord: GridCoord, type: ModuleType): ModuleInstance {
    const key = toGridKey(coord);
    if (this.cells.has(key)) {
      throw new Error(`GridState: Cell ${key} is already occupied.`);
    }

    const instance: ModuleInstance = {
      instanceId: `mod_${this.nextInstanceId++}`,
      type,
      qx: coord.qx,
      qy: coord.qy,
      health: 100,
      isActive: true,
      isPowered: false,
      metadata: {},
    };

    this.cells.set(key, instance);
    return instance;
  }

  /** Remove a module by its grid coordinate. Returns the removed instance or null. */
  removeModule(coord: GridCoord): ModuleInstance | null {
    const key = toGridKey(coord);
    const instance = this.cells.get(key) ?? null;
    if (instance) this.cells.delete(key);
    return instance;
  }

  /** Get a module at a grid coordinate. Returns null if empty. */
  getModule(coord: GridCoord): ModuleInstance | null {
    return this.cells.get(toGridKey(coord)) ?? null;
  }

  /** Get a module by instance ID. O(n) — use sparingly. */
  getModuleById(instanceId: string): ModuleInstance | null {
    for (const instance of this.cells.values()) {
      if (instance.instanceId === instanceId) return instance;
    }
    return null;
  }

  /** Update a module's properties in place (e.g., health, isPowered). */
  updateModule(instanceId: string, updates: Partial<ModuleInstance>): void {
    const coord = this.findCoordById(instanceId);
    if (!coord) throw new Error(`GridState: Instance ${instanceId} not found.`);
    const key = toGridKey(coord);
    const existing = this.cells.get(key)!;
    this.cells.set(key, { ...existing, ...updates, instanceId, qx: coord.qx, qy: coord.qy });
  }

  /** Update a module's health clamped to [0, 100]. */
  updateModuleHealth(instanceId: string, health: number): void {
    this.updateModule(instanceId, { health: Math.max(0, Math.min(100, health)) });
  }

  /** Get all placed module instances. */
  getAllModules(): ModuleInstance[] {
    return Array.from(this.cells.values());
  }

  /** Check whether a cell is occupied. */
  isOccupied(coord: GridCoord): boolean {
    return this.cells.has(toGridKey(coord));
  }

  /** Get all neighbors (orthogonal) of a coordinate that are occupied. */
  getOccupiedNeighbors(coord: GridCoord): ModuleInstance[] {
    return getNeighborCoords(coord)
      .map((n) => this.getModule(n))
      .filter((m): m is ModuleInstance => m !== null);
  }

  /** Total number of placed modules. */
  get size(): number {
    return this.cells.size;
  }

  /** Serialize to save format. */
  toJSON(): Array<{
    qx: number;
    qy: number;
    type: ModuleType;
    health: number;
    is_active: boolean;
    metadata: Record<string, number | string | boolean>;
  }> {
    return this.getAllModules().map((m) => ({
      qx: m.qx,
      qy: m.qy,
      type: m.type,
      health: m.health,
      is_active: m.isActive,
      metadata: m.metadata as Record<string, number | string | boolean>,
    }));
  }

  /** Restore from save format. */
  fromJSON(
    data: Array<{
      qx: number;
      qy: number;
      type: ModuleType;
      health: number;
      is_active: boolean;
      metadata?: Record<string, number | string | boolean>;
    }>,
  ): void {
    this.cells.clear();
    this.nextInstanceId = 1;
    for (const entry of data) {
      this.placeModule({ qx: entry.qx, qy: entry.qy }, entry.type);
      const instance = this.getModule({ qx: entry.qx, qy: entry.qy })!;
      instance.health = entry.health;
      instance.isActive = entry.is_active;
      instance.metadata = (entry.metadata ?? {}) as Record<
        string,
        number | string | boolean | undefined
      >;
    }
  }

  /** Find the GridCoord for a given instance ID. */
  private findCoordById(instanceId: string): GridCoord | null {
    for (const [key, instance] of this.cells.entries()) {
      if (instance.instanceId === instanceId) return fromGridKey(key);
    }
    return null;
  }
}
