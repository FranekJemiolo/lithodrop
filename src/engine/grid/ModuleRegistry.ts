/**
 * ModuleRegistry — Authoritative catalog of all module types.
 *
 * Each entry defines the full physics/game profile for a module:
 * mass, drag, cost, power delta, yield rate, and structural support.
 *
 * The Registry is the single source of truth for module stats.
 * All systems read from here — never hardcode module values elsewhere.
 */

import type { ModuleType, ModuleFunction, ResourceType } from "./types";

export interface ModuleDefinition {
  type: ModuleType;
  displayName: string;
  description: string;
  /** kg — determines descent physics */
  mass: number;
  /** 0.1 (aerodynamic) to 2.4 (sail) */
  dragCoefficient: number;
  /** m/s downward velocity that won't damage */
  impactTolerance: number;
  /** Megacorp Credits base cost */
  baseCost: number;
  /** Game function category */
  function: ModuleFunction;
  /** +ve = generation, -ve = consumption (per second) */
  powerDelta: number;
  /** Structural load-bearing capacity (tonnes) — 0 = non-structural */
  structuralSupport: number;
  /** Primary resource produced per second (null = none) */
  baseYield: ResourceType | null;
  /** Amount of baseYield produced per second */
  baseYieldRate: number;
  /** Water consumed per second (0 = none) */
  waterConsumption: number;
  /** Colour swatch for HUD/UI rendering (hex number) */
  colorHex: number;
  /** Whether this module is placeable freely (false = special unlock required) */
  freely_placeable: boolean;
}

export const MODULE_REGISTRY: Record<ModuleType, ModuleDefinition> = {
  titanium_foundation: {
    type: "titanium_foundation",
    displayName: "Titanium Foundation",
    description:
      "Heavy structural slab. Anchor point for all column builds. Supports up to 80t of stacked modules.",
    mass: 8400,
    dragCoefficient: 0.3,
    impactTolerance: 12.0,
    baseCost: 800,
    function: "structural",
    powerDelta: 0,
    structuralSupport: 80,
    baseYield: null,
    baseYieldRate: 0,
    waterConsumption: 0,
    colorHex: 0x5a6a80,
    freely_placeable: true,
  },

  solar_array: {
    type: "solar_array",
    displayName: "Solar Array",
    description:
      "Wide-profile photovoltaic panel. High drag in atmosphere. Generates 40 power units/s in daylight.",
    mass: 1200,
    dragCoefficient: 2.4,
    impactTolerance: 4.5,
    baseCost: 1200,
    function: "power_generation",
    powerDelta: +40,
    structuralSupport: 0,
    baseYield: "power",
    baseYieldRate: 40,
    waterConsumption: 0,
    colorHex: 0xffd700,
    freely_placeable: true,
  },

  crew_habitat: {
    type: "crew_habitat",
    displayName: "Crew Habitat",
    description: "Pressurised living quarters for 12 engineers. Requires 20 power and 5 water/s.",
    mass: 3200,
    dragCoefficient: 0.8,
    impactTolerance: 7.0,
    baseCost: 2500,
    function: "habitation",
    powerDelta: -20,
    structuralSupport: 10,
    baseYield: null,
    baseYieldRate: 0,
    waterConsumption: 5,
    colorHex: 0xff6b2b,
    freely_placeable: true,
  },

  fission_reactor: {
    type: "fission_reactor",
    displayName: "Fission Reactor",
    description:
      "High-output nuclear plant. 200 power/s. Requires active cooling — place adjacent to Battery Bank.",
    mass: 12000,
    dragCoefficient: 0.45,
    impactTolerance: 8.0,
    baseCost: 8000,
    function: "power_generation",
    powerDelta: +200,
    structuralSupport: 20,
    baseYield: "power",
    baseYieldRate: 200,
    waterConsumption: 0,
    colorHex: 0xff2d2d,
    freely_placeable: true,
  },

  hydroponics_dome: {
    type: "hydroponics_dome",
    displayName: "Hydroponics Dome",
    description:
      "Fragile geodesic food farm. 2.5 m/s impact tolerance — land with extreme care. Produces 8 food/s.",
    mass: 900,
    dragCoefficient: 1.1,
    impactTolerance: 2.5,
    baseCost: 1500,
    function: "food_production",
    powerDelta: -10,
    structuralSupport: 0,
    baseYield: "food",
    baseYieldRate: 8,
    waterConsumption: 8,
    colorHex: 0x39ff6b,
    freely_placeable: true,
  },

  deep_core_drill: {
    type: "deep_core_drill",
    displayName: "Deep Core Drill",
    description:
      "Narrow aerodynamic drill head. Falls fast. Extracts 15 minerals/s from planetary crust.",
    mass: 5500,
    dragCoefficient: 0.22,
    impactTolerance: 6.0,
    baseCost: 3500,
    function: "mineral_extraction",
    powerDelta: -60,
    structuralSupport: 15,
    baseYield: "minerals",
    baseYieldRate: 15,
    waterConsumption: 0,
    colorHex: 0x8b9ab5,
    freely_placeable: true,
  },

  shock_absorber_strut: {
    type: "shock_absorber_strut",
    displayName: "Shock Absorber Strut",
    description:
      "Indestructible landing strut. Absorbs any impact. Required for cliff-face anchoring on canyon worlds.",
    mass: 400,
    dragCoefficient: 0.35,
    impactTolerance: 999,
    baseCost: 200,
    function: "structural",
    powerDelta: 0,
    structuralSupport: 40,
    baseYield: null,
    baseYieldRate: 0,
    waterConsumption: 0,
    colorHex: 0x4a5a6a,
    freely_placeable: true,
  },

  science_lab: {
    type: "science_lab",
    displayName: "Science Laboratory",
    description:
      "Produces 2 Research Data/min used to unlock tech tree nodes. Doubles mineral yield when adjacent to drill.",
    mass: 2800,
    dragCoefficient: 0.65,
    impactTolerance: 5.5,
    baseCost: 4000,
    function: "data_production",
    powerDelta: -40,
    structuralSupport: 5,
    baseYield: "data",
    baseYieldRate: 2,
    waterConsumption: 2,
    colorHex: 0x00d4ff,
    freely_placeable: true,
  },

  robotics_hub: {
    type: "robotics_hub",
    displayName: "Robotics Hub",
    description:
      "Dispatches and manages repair drones. Each hub supports up to 3 active drones simultaneously.",
    mass: 3100,
    dragCoefficient: 0.7,
    impactTolerance: 6.5,
    baseCost: 3000,
    function: "drone_hub",
    powerDelta: -30,
    structuralSupport: 10,
    baseYield: null,
    baseYieldRate: 0,
    waterConsumption: 0,
    colorHex: 0x9966ff,
    freely_placeable: true,
  },

  water_extractor: {
    type: "water_extractor",
    displayName: "Water Extractor",
    description:
      "Mines subsurface ice or liquid water. Produces 10 water/s. Rate doubles adjacent to Thermal Generator.",
    mass: 2000,
    dragCoefficient: 0.55,
    impactTolerance: 6.0,
    baseCost: 1000,
    function: "water_supply",
    powerDelta: -15,
    structuralSupport: 5,
    baseYield: "water",
    baseYieldRate: 10,
    waterConsumption: 0,
    colorHex: 0x0099cc,
    freely_placeable: true,
  },

  battery_bank: {
    type: "battery_bank",
    displayName: "Battery Bank",
    description:
      "Stores 500 power units. Enables dark-cycle operation for Solar Arrays. Essential on Luna Prime.",
    mass: 1800,
    dragCoefficient: 0.4,
    impactTolerance: 8.0,
    baseCost: 600,
    function: "power_storage",
    powerDelta: 0, // Zero delta when balanced; positive during discharge
    structuralSupport: 10,
    baseYield: null,
    baseYieldRate: 0,
    waterConsumption: 0,
    colorHex: 0xffaa00,
    freely_placeable: true,
  },

  thermal_generator: {
    type: "thermal_generator",
    displayName: "Thermal Generator",
    description:
      "Taps geothermal vents for 80 power/s. Doubles adjacent Water Extractor yield via steam injection.",
    mass: 2200,
    dragCoefficient: 0.5,
    impactTolerance: 6.0,
    baseCost: 2000,
    function: "thermal_power",
    powerDelta: +80,
    structuralSupport: 15,
    baseYield: "power",
    baseYieldRate: 80,
    waterConsumption: 0,
    colorHex: 0xff4400,
    freely_placeable: true,
  },

  comms_relay: {
    type: "comms_relay",
    displayName: "Comms Relay",
    description: "Maintains orbital link. Boosts Science Lab data output by 40% when adjacent.",
    mass: 500,
    dragCoefficient: 0.6,
    impactTolerance: 4.0,
    baseCost: 1800,
    function: "connectivity",
    powerDelta: -5,
    structuralSupport: 0,
    baseYield: null,
    baseYieldRate: 0,
    waterConsumption: 0,
    colorHex: 0x44ffaa,
    freely_placeable: true,
  },

  anchor_project: {
    type: "anchor_project",
    displayName: "ANCHOR PROJECT",
    description:
      "The final deliverable. Requires a prebuilt foundation and sustained quota. Completing this wins the planet.",
    mass: 45000,
    dragCoefficient: 0.6,
    impactTolerance: 5.0,
    baseCost: 50000,
    function: "anchor",
    powerDelta: -800,
    structuralSupport: 0,
    baseYield: null,
    baseYieldRate: 0,
    waterConsumption: 0,
    colorHex: 0xffffff,
    freely_placeable: false,
  },
};

/** Get definition for a module type. Throws if unknown. */
export function getModuleDef(type: ModuleType): ModuleDefinition {
  const def = MODULE_REGISTRY[type];
  if (!def) throw new Error(`ModuleRegistry: Unknown module type "${type}"`);
  return def;
}

/** Get all freely placeable module definitions (for the Module Dock UI). */
export function getDroppableModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter((d) => d.freely_placeable);
}
