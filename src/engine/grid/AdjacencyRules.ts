/**
 * AdjacencyRules — Placement bonus rules for adjacent module pairs.
 *
 * When modules of specific types are placed adjacent to each other,
 * the source module's output is multiplied by the bonus multiplier.
 *
 * Rules are evaluated by DependencyGraph on every grid mutation.
 * All bonuses are additive (multiple applicable bonuses stack multiplicatively).
 */

import type { AdjacencyBonus, ModuleType, ResourceType } from "./types";

/**
 * The full adjacency bonus table.
 * Order matters: more specific rules should come first.
 */
export const ADJACENCY_RULES: AdjacencyBonus[] = [
  // Science Lab doubles Deep Core Drill mineral yield
  {
    sourceType: "deep_core_drill",
    neighborType: "science_lab",
    description: "Science-guided extraction: +20% mineral yield",
    multiplier: 1.2,
    resource: "minerals",
  },

  // Thermal Generator doubles Water Extractor yield (steam injection)
  {
    sourceType: "water_extractor",
    neighborType: "thermal_generator",
    description: "Steam-assisted extraction: +100% water yield",
    multiplier: 2.0,
    resource: "water",
  },

  // Hydroponics Dome benefits from adjacent Crew Habitat (labor) → Science Labs produce more data
  {
    sourceType: "science_lab",
    neighborType: "crew_habitat",
    description: "Resident researchers: +25% data output",
    multiplier: 1.25,
    resource: "data",
  },

  // Comms Relay boosts Science Lab data output
  {
    sourceType: "science_lab",
    neighborType: "comms_relay",
    description: "Orbital uplink: +40% data output",
    multiplier: 1.4,
    resource: "data",
  },

  // Fission Reactor adjacent to Battery Bank → buffered power is more stable
  {
    sourceType: "fission_reactor",
    neighborType: "battery_bank",
    description: "Load levelling: +15% power output",
    multiplier: 1.15,
    resource: "power",
  },

  // Solar Array adjacent to Battery Bank → enables dark-cycle operation
  {
    sourceType: "solar_array",
    neighborType: "battery_bank",
    description: "Dark cycle storage: sustains power at night",
    multiplier: 1.0, // No yield bonus, but enables night operation (handled by EconomyEngine)
    resource: "power",
  },

  // Water Extractor adjacent to Hydroponics Dome → more efficient irrigation
  {
    sourceType: "hydroponics_dome",
    neighborType: "water_extractor",
    description: "Efficient irrigation: +30% food output",
    multiplier: 1.3,
    resource: "food",
  },

  // Robotics Hub adjacent to Crew Habitat → additional drone capacity (+1 per pair)
  {
    sourceType: "robotics_hub",
    neighborType: "crew_habitat",
    description: "Human-robot collaboration: +1 active drone capacity",
    multiplier: 1.0, // Bonus is logical (drone cap), not yield-based
    resource: "minerals", // placeholder — drone cap bonus handled separately
  },
];

/**
 * Get all adjacency bonuses that apply to a given source module
 * when a neighbor of neighborType is present.
 */
export function getApplicableBonuses(
  sourceType: ModuleType,
  presentNeighborTypes: ModuleType[],
): AdjacencyBonus[] {
  return ADJACENCY_RULES.filter(
    (rule) => rule.sourceType === sourceType && presentNeighborTypes.includes(rule.neighborType),
  );
}

/**
 * Calculate the combined output multiplier for a module given its neighbors.
 * Multiple matching bonuses multiply together (e.g., 1.2 × 1.4 = 1.68).
 *
 * @param sourceType - The module being evaluated
 * @param neighborTypes - Types of all adjacent occupied cells
 * @param resource - Only bonuses for this resource type are included
 * @returns Combined multiplier [1.0 = no bonus, 2.0 = double output, etc.]
 */
export function calculateAdjacencyMultiplier(
  sourceType: ModuleType,
  neighborTypes: ModuleType[],
  resource: ResourceType,
): number {
  const applicable = ADJACENCY_RULES.filter(
    (rule) =>
      rule.sourceType === sourceType &&
      rule.resource === resource &&
      neighborTypes.includes(rule.neighborType),
  );

  return applicable.reduce((acc, rule) => acc * rule.multiplier, 1.0);
}
