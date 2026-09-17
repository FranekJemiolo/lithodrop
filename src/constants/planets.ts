/**
 * Planet definitions — configuration for all 6 campaign planets.
 *
 * Each planet defines its environment, hazards, terrain parameters,
 * win condition, and the Anchor Project final payload.
 */

import type { ModuleType } from "../engine/grid/types";

export interface HazardDefinition {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  /** Average time between occurrences in seconds */
  meanIntervalSeconds: number;
  description: string;
}

export interface PlanetDefinition {
  id: string;
  displayName: string;
  tagline: string;
  /** Background gradient color (deep) */
  skyColorDeep: number;
  /** Background gradient color (horizon) */
  skyColorHorizon: number;
  /** Surface/terrain color */
  terrainColor: number;
  gravityMs2: number;
  /** 0 = vacuum, 1 = dense */
  atmosphereDensity: number;
  /** Wind base speed in m/s (0 = none) */
  baseWindSpeedMs: number;
  /** Wind variation ±m/s */
  windVarianceMs: number;
  /** Procedural terrain seed for deterministic generation */
  terrainSeed: number;
  /** Terrain roughness [0–1] */
  terrainRoughness: number;
  /** Whether terrain has canyon walls (constrains lateral movement) */
  hasCanyonWalls: boolean;
  /** Whether base platform floats (buoyancy mechanic) */
  isFloatingPlatform: boolean;
  hazards: HazardDefinition[];
  /** Credit/s required to trigger Anchor Project authorization */
  quotaCreditsPerSecond: number;
  /** Seconds the quota must be sustained */
  quotaSustainSeconds: number;
  anchorProject: {
    moduleType: ModuleType;
    displayName: string;
    powerRequired: number;
    foundationBlocksRequired: number;
    victoryDescription: string;
  };
  /** Unlock prerequisite planet ID (null = starting planet) */
  prerequisitePlanetId: string | null;
}

export const PLANETS: PlanetDefinition[] = [
  {
    id: "luna_prime",
    displayName: "Luna Prime",
    tagline: "The Proving Ground. No excuses.",
    skyColorDeep: 0x000005,
    skyColorHorizon: 0x0a0a1a,
    terrainColor: 0x6b7080,
    gravityMs2: 1.62,
    atmosphereDensity: 0.0,
    baseWindSpeedMs: 0,
    windVarianceMs: 0,
    terrainSeed: 42,
    terrainRoughness: 0.2,
    hasCanyonWalls: false,
    isFloatingPlatform: false,
    hazards: [
      {
        type: "micro_meteor",
        severity: "low",
        meanIntervalSeconds: 120,
        description: "Micro-meteorite showers cause minor hull abrasion.",
      },
    ],
    quotaCreditsPerSecond: 100,
    quotaSustainSeconds: 60,
    anchorProject: {
      moduleType: "anchor_project",
      displayName: "Lunar Space Elevator Tether",
      powerRequired: 300,
      foundationBlocksRequired: 6,
      victoryDescription:
        "The tether is anchored. Luna Prime is now a permanent waypoint on the colonization route.",
    },
    prerequisitePlanetId: null,
  },
  {
    id: "serpentine_rifts",
    displayName: "The Serpentine Rifts",
    tagline: "The canyon doesn't care about your fuel budget.",
    skyColorDeep: 0x050310,
    skyColorHorizon: 0x1a0828,
    terrainColor: 0x3a2830,
    gravityMs2: 4.2,
    atmosphereDensity: 0.08,
    baseWindSpeedMs: 8,
    windVarianceMs: 4,
    terrainSeed: 137,
    terrainRoughness: 0.9,
    hasCanyonWalls: true,
    isFloatingPlatform: false,
    hazards: [
      {
        type: "rockslide",
        severity: "medium",
        meanIntervalSeconds: 90,
        description: "Heavy landings trigger rockslides from canyon walls.",
      },
      {
        type: "acoustic_resonance",
        severity: "medium",
        meanIntervalSeconds: 60,
        description: "High winds cause acoustic resonance in tall structures.",
      },
    ],
    quotaCreditsPerSecond: 180,
    quotaSustainSeconds: 60,
    anchorProject: {
      moduleType: "anchor_project",
      displayName: "Deep Shaft Mining Relay",
      powerRequired: 450,
      foundationBlocksRequired: 4,
      victoryDescription:
        "The rift network is mapped and tapped. Mineral extraction at industrial scale begins.",
    },
    prerequisitePlanetId: "luna_prime",
  },
  {
    id: "thalassa",
    displayName: "Thalassa",
    tagline: "Balance or drown.",
    skyColorDeep: 0x000a14,
    skyColorHorizon: 0x001428,
    terrainColor: 0x002850,
    gravityMs2: 9.1,
    atmosphereDensity: 0.95,
    baseWindSpeedMs: 12,
    windVarianceMs: 8,
    terrainSeed: 256,
    terrainRoughness: 0.0, // ocean — flat but moving
    hasCanyonWalls: false,
    isFloatingPlatform: true,
    hazards: [
      {
        type: "storm_surge",
        severity: "high",
        meanIntervalSeconds: 480,
        description: "Storm surges tilt the pontoon base significantly.",
      },
      {
        type: "saltwater_spray",
        severity: "low",
        meanIntervalSeconds: 30,
        description: "Corrosive saltwater spray degrades coastal modules.",
      },
    ],
    quotaCreditsPerSecond: 250,
    quotaSustainSeconds: 60,
    anchorProject: {
      moduleType: "anchor_project",
      displayName: "Oceanic Mineral Siphon",
      powerRequired: 600,
      foundationBlocksRequired: 8,
      victoryDescription:
        "The siphon draws dissolved rare minerals from the global ocean. Thalassa is online.",
    },
    prerequisitePlanetId: "serpentine_rifts",
  },
  {
    id: "zephyrus",
    displayName: "Zephyrus",
    tagline: "You are the heaviest thing allowed here.",
    skyColorDeep: 0x0f0505,
    skyColorHorizon: 0x3a1400,
    terrainColor: 0x5a2800,
    gravityMs2: 18.0, // at platform altitude
    atmosphereDensity: 0.85,
    baseWindSpeedMs: 25,
    windVarianceMs: 15,
    terrainSeed: 512,
    terrainRoughness: 0.0,
    hasCanyonWalls: false,
    isFloatingPlatform: true,
    hazards: [
      {
        type: "lightning_emp",
        severity: "medium",
        meanIntervalSeconds: 180,
        description: "Lightning discharges cause EMP events, cutting thrust for 1.5 seconds.",
      },
      {
        type: "thermal_downdraft",
        severity: "high",
        meanIntervalSeconds: 45,
        description: "Microbursts double descent rate without warning.",
      },
    ],
    quotaCreditsPerSecond: 320,
    quotaSustainSeconds: 60,
    anchorProject: {
      moduleType: "anchor_project",
      displayName: "Upper Atmosphere Harvester",
      powerRequired: 750,
      foundationBlocksRequired: 6,
      victoryDescription:
        "Helium-3 extraction from the upper atmosphere begins. Zephyrus is a fuel source for the fleet.",
    },
    prerequisitePlanetId: "thalassa",
  },
  {
    id: "the_outer_dark",
    displayName: "The Outer Dark",
    tagline: "The void stares back.",
    skyColorDeep: 0x000000,
    skyColorHorizon: 0x020205,
    terrainColor: 0x1a1a2a,
    gravityMs2: 0.8,
    atmosphereDensity: 0.0,
    baseWindSpeedMs: 0,
    windVarianceMs: 0,
    terrainSeed: 999,
    terrainRoughness: 0.4,
    hasCanyonWalls: false,
    isFloatingPlatform: false,
    hazards: [
      {
        type: "cryogenic_failure",
        severity: "high",
        meanIntervalSeconds: 120,
        description: "Extreme cold causes equipment failures in exposed modules.",
      },
      {
        type: "morale_decay",
        severity: "critical",
        meanIntervalSeconds: 60,
        description: "Isolation and darkness erode engineer morale continuously.",
      },
    ],
    quotaCreditsPerSecond: 200,
    quotaSustainSeconds: 60,
    anchorProject: {
      moduleType: "anchor_project",
      displayName: "Deep Space Beacon Array",
      powerRequired: 400,
      foundationBlocksRequired: 4,
      victoryDescription:
        "A permanent signal marks The Outer Dark on navigation charts. No ship will be lost here again.",
    },
    prerequisitePlanetId: "zephyrus",
  },
  {
    id: "vulcanis",
    displayName: "Vulcanis",
    tagline: "Everything here wants to melt.",
    skyColorDeep: 0x0f0400,
    skyColorHorizon: 0x3a1000,
    terrainColor: 0x2a0800,
    gravityMs2: 7.4,
    atmosphereDensity: 0.7,
    baseWindSpeedMs: 15,
    windVarianceMs: 20,
    terrainSeed: 777,
    terrainRoughness: 0.95,
    hasCanyonWalls: false,
    isFloatingPlatform: false,
    hazards: [
      {
        type: "seismic_liquefaction",
        severity: "high",
        meanIntervalSeconds: 30,
        description: "Heavy landings liquefy the thin crust, starting sinkhole timers.",
      },
      {
        type: "pyroclastic_flow",
        severity: "critical",
        meanIntervalSeconds: 900,
        description: "Pyroclastic flows destroy any module in their path.",
      },
      {
        type: "ash_clog",
        severity: "medium",
        meanIntervalSeconds: 20,
        description: "Volcanic ash progressively clogs thruster nozzles, reducing efficiency.",
      },
    ],
    quotaCreditsPerSecond: 400,
    quotaSustainSeconds: 60,
    anchorProject: {
      moduleType: "anchor_project",
      displayName: "Planetary Terraforming Seed Engine",
      powerRequired: 800,
      foundationBlocksRequired: 8,
      victoryDescription:
        "Atmospheric nitrogen seeding begins. In 200 years, Vulcanis will breathe.",
    },
    prerequisitePlanetId: "the_outer_dark",
  },
];

/** Look up a planet by its ID */
export function getPlanetById(id: string): PlanetDefinition {
  const planet = PLANETS.find((p) => p.id === id);
  if (!planet) throw new Error(`Unknown planet ID: ${id}`);
  return planet;
}
