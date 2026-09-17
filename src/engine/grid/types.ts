/**
 * Grid types — Shared type definitions for the base-building grid system.
 *
 * All grid coordinates use a sparse integer (qx, qy) system relative to
 * an anchor point at (0,0). This keeps save payloads tiny regardless of
 * base sprawl.
 */

// ─── Module Catalog ──────────────────────────────────────────────────────────

export type ModuleType =
  | "titanium_foundation"
  | "solar_array"
  | "crew_habitat"
  | "fission_reactor"
  | "hydroponics_dome"
  | "deep_core_drill"
  | "shock_absorber_strut"
  | "science_lab"
  | "robotics_hub"
  | "water_extractor"
  | "battery_bank"
  | "thermal_generator"
  | "comms_relay"
  | "anchor_project";

export type ModuleFunction =
  | "structural"
  | "power_generation"
  | "power_storage"
  | "life_support"
  | "habitation"
  | "food_production"
  | "mineral_extraction"
  | "data_production"
  | "drone_hub"
  | "water_supply"
  | "thermal_power"
  | "connectivity"
  | "anchor";

export type ResourceType = "power" | "water" | "air" | "minerals" | "data" | "food";

// ─── Grid Coordinate ─────────────────────────────────────────────────────────

export interface GridCoord {
  qx: number;
  qy: number;
}

/** String key for Map lookups: "qx,qy" */
export type GridKey = string;

export function toGridKey(coord: GridCoord): GridKey {
  return `${coord.qx},${coord.qy}`;
}

export function fromGridKey(key: GridKey): GridCoord {
  const [qx, qy] = key.split(",").map(Number);
  return { qx, qy };
}

/** Returns the 4 orthogonal neighbors of a grid cell */
export function getNeighborCoords(coord: GridCoord): GridCoord[] {
  const { qx, qy } = coord;
  return [
    { qx: qx + 1, qy },
    { qx: qx - 1, qy },
    { qx, qy: qy + 1 },
    { qx, qy: qy - 1 },
  ];
}

// ─── Module Instance ─────────────────────────────────────────────────────────

export interface ModuleMetadata {
  coolingCyclesMissed?: number;
  buoyancyOffset?: number;
  repairsQueued?: number;
  [key: string]: number | string | boolean | undefined;
}

export interface ModuleInstance {
  instanceId: string;
  type: ModuleType;
  qx: number;
  qy: number;
  /** Health [0–100] */
  health: number;
  isActive: boolean;
  isPowered: boolean;
  metadata: ModuleMetadata;
}

// ─── Adjacency Bonus ─────────────────────────────────────────────────────────

export interface AdjacencyBonus {
  sourceType: ModuleType;
  neighborType: ModuleType;
  description: string;
  /** Multiplier applied to the source module's output (e.g. 1.25 = +25%) */
  multiplier: number;
  resource: ResourceType;
}

// ─── Dependency Graph Edge ────────────────────────────────────────────────────

export interface DependencyEdge {
  fromKey: GridKey;
  toKey: GridKey;
  resource: ResourceType;
  /** Flow rate per game tick */
  flowRate: number;
}

// ─── Resource Flow Summary ───────────────────────────────────────────────────

export interface ResourceFlowSummary {
  powerGenerated: number;
  powerConsumed: number;
  waterGenerated: number;
  waterConsumed: number;
  mineralsPerSecond: number;
  dataPerSecond: number;
  foodPerSecond: number;
}
