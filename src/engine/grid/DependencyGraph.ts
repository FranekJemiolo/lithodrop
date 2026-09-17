/**
 * DependencyGraph — BFS-based resource flow and connectivity tracker.
 *
 * The graph is rebuilt from scratch whenever the grid changes
 * (MODULE_SNAPPED or MODULE_DESTROYED events). Rebuilding is fast
 * enough for grids up to ~500 modules in <2ms.
 *
 * Responsibilities:
 *   1. Track power connectivity: which modules are reachable from
 *      a power source via adjacent modules.
 *   2. Track which modules are "orphaned" (disconnected from the hub).
 *   3. Calculate per-module adjacency-modified yield rates.
 *   4. Produce the ResourceFlowSummary for the EconomyEngine.
 *
 * Architecture note: DependencyGraph reads GridState but never mutates it.
 * All write-back (marking isPowered on ModuleInstance) happens via
 * GridState.updateModule after the BFS completes.
 */

import type { GridState } from "./GridState";
import type { ModuleInstance, GridCoord, ResourceFlowSummary } from "./types";
import { toGridKey, getNeighborCoords } from "./types";
import { getModuleDef } from "./ModuleRegistry";
import { calculateAdjacencyMultiplier } from "./AdjacencyRules";

export interface GraphNode {
  instance: ModuleInstance;
  isPowered: boolean;
  /** Combined adjacency multiplier for primary resource output */
  adjacencyMultiplier: number;
  /** Effective yield per second after adjacency and power */
  effectiveYieldRate: number;
  /** Distance (hops) from nearest power source */
  distanceFromPower: number;
}

export class DependencyGraph {
  private nodes = new Map<string, GraphNode>();
  private powerSources = new Set<string>(); // instance IDs

  /**
   * Rebuild the entire dependency graph from the current GridState.
   * Call this after any grid mutation.
   */
  rebuild(grid: GridState): ResourceFlowSummary {
    this.nodes.clear();
    this.powerSources.clear();

    const modules = grid.getAllModules();

    // Phase 1: Build graph nodes with adjacency multipliers
    for (const instance of modules) {
      const coord: GridCoord = { qx: instance.qx, qy: instance.qy };
      const neighbors = grid.getOccupiedNeighbors(coord);
      const neighborTypes = neighbors.map((n) => n.type);
      const def = getModuleDef(instance.type);

      const primaryResource = def.baseYield;
      const adjacencyMultiplier = primaryResource
        ? calculateAdjacencyMultiplier(instance.type, neighborTypes, primaryResource)
        : 1.0;

      this.nodes.set(instance.instanceId, {
        instance,
        isPowered: false,
        adjacencyMultiplier,
        effectiveYieldRate: 0,
        distanceFromPower: Infinity,
      });

      // Track power sources
      if (def.powerDelta > 0) {
        this.powerSources.add(instance.instanceId);
      }
    }

    // Phase 2: BFS from all power sources to determine what's powered
    this.propagatePower(grid);

    // Phase 3: Calculate effective yield for each powered module
    this.calculateEffectiveYields();

    // Phase 4: Build and return the flow summary
    return this.buildFlowSummary();
  }

  /** Get a graph node by instance ID */
  getNode(instanceId: string): GraphNode | undefined {
    return this.nodes.get(instanceId);
  }

  /** Get all nodes that are currently orphaned (not powered) */
  getOrphanedNodes(): GraphNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => !n.isPowered && getModuleDef(n.instance.type).powerDelta < 0,
    );
  }

  /**
   * BFS from all power sources through adjacent occupied cells.
   * Any module reachable from a power source is considered powered.
   */
  private propagatePower(grid: GridState): void {
    const visited = new Set<string>(); // instance IDs
    const queue: string[] = [...this.powerSources];

    // Power sources power themselves
    for (const srcId of this.powerSources) {
      const node = this.nodes.get(srcId);
      if (node) {
        node.isPowered = true;
        node.distanceFromPower = 0;
        visited.add(srcId);
      }
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = this.nodes.get(currentId);
      if (!currentNode) continue;

      const coord: GridCoord = { qx: currentNode.instance.qx, qy: currentNode.instance.qy };
      const neighborCoords = getNeighborCoords(coord);

      for (const neighborCoord of neighborCoords) {
        const neighborModule = grid.getModule(neighborCoord);
        if (!neighborModule) continue;

        const neighborId = neighborModule.instanceId;
        if (visited.has(neighborId)) continue;

        visited.add(neighborId);
        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        neighborNode.isPowered = true;
        neighborNode.distanceFromPower = currentNode.distanceFromPower + 1;
        queue.push(neighborId);
      }
    }
  }

  private calculateEffectiveYields(): void {
    for (const node of this.nodes.values()) {
      const def = getModuleDef(node.instance.type);
      const powerEfficiency = node.isPowered ? 1.0 : 0.0;
      const healthFactor = node.instance.health / 100;

      node.effectiveYieldRate =
        def.baseYieldRate * node.adjacencyMultiplier * powerEfficiency * healthFactor;
    }
  }

  private buildFlowSummary(): ResourceFlowSummary {
    let powerGenerated = 0;
    let powerConsumed = 0;
    let waterGenerated = 0;
    let waterConsumed = 0;
    let mineralsPerSecond = 0;
    let dataPerSecond = 0;
    let foodPerSecond = 0;

    for (const node of this.nodes.values()) {
      const def = getModuleDef(node.instance.type);
      const powered = node.isPowered;
      const healthFactor = node.instance.health / 100;

      // Power flow
      if (def.powerDelta > 0) {
        powerGenerated += def.powerDelta * healthFactor;
      } else if (def.powerDelta < 0 && powered) {
        powerConsumed += Math.abs(def.powerDelta);
      }

      // Water flow
      if (def.baseYield === "water" && powered) {
        waterGenerated += node.effectiveYieldRate;
      }
      if (def.waterConsumption > 0 && powered) {
        waterConsumed += def.waterConsumption;
      }

      // Export resources
      if (powered) {
        if (def.baseYield === "minerals") mineralsPerSecond += node.effectiveYieldRate;
        if (def.baseYield === "data") dataPerSecond += node.effectiveYieldRate;
        if (def.baseYield === "food") foodPerSecond += node.effectiveYieldRate;
      }
    }

    return {
      powerGenerated,
      powerConsumed,
      waterGenerated,
      waterConsumed,
      mineralsPerSecond,
      dataPerSecond,
      foodPerSecond,
    };
  }

  /**
   * BFS shortest path between two module instances.
   * Used by drone dispatch to find movement paths.
   * Returns null if no path exists (module is orphaned).
   */
  findPath(grid: GridState, fromInstanceId: string, toInstanceId: string): GridCoord[] | null {
    const fromNode = this.nodes.get(fromInstanceId);
    const toNode = this.nodes.get(toInstanceId);
    if (!fromNode || !toNode) return null;

    const start: GridCoord = { qx: fromNode.instance.qx, qy: fromNode.instance.qy };
    const goal: GridCoord = { qx: toNode.instance.qx, qy: toNode.instance.qy };

    const visited = new Set<string>();
    const queue: { coord: GridCoord; path: GridCoord[] }[] = [{ coord: start, path: [start] }];

    while (queue.length > 0) {
      const { coord, path } = queue.shift()!;
      const key = toGridKey(coord);

      if (visited.has(key)) continue;
      visited.add(key);

      if (coord.qx === goal.qx && coord.qy === goal.qy) return path;

      for (const neighbor of getNeighborCoords(coord)) {
        const neighborKey = toGridKey(neighbor);
        if (visited.has(neighborKey)) continue;
        if (!grid.isOccupied(neighbor)) continue;
        queue.push({ coord: neighbor, path: [...path, neighbor] });
      }
    }

    return null; // No path — orphaned module
  }
}
