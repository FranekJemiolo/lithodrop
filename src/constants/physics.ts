/**
 * Physics constants — single source of truth for all physics values.
 *
 * All values use SI units (meters, kilograms, seconds) internally.
 * The game-world scale is 1 pixel = 0.5 meters at 1× zoom.
 */

// ─── Scale ───────────────────────────────────────────────────────────────────

/** Pixels per meter at 1× zoom */
export const PIXELS_PER_METER = 2;

/** Convert meters to pixels */
export function metersToPixels(meters: number): number {
  return meters * PIXELS_PER_METER;
}

/** Convert pixels to meters */
export function pixelsToMeters(px: number): number {
  return px / PIXELS_PER_METER;
}

// ─── Gravity ─────────────────────────────────────────────────────────────────

/** Gravity in m/s² per planet */
export const PLANET_GRAVITY: Record<string, number> = {
  luna_prime: 1.62,
  serpentine_rifts: 4.2,
  thalassa: 9.1,
  zephyrus: 24.8,
  the_outer_dark: 0.8,
  vulcanis: 7.4,
};

// ─── Physics Engine ────────────────────────────────────────────────────────────

/** Fixed physics tick rate in Hz (20ms per step) */
export const PHYSICS_TICK_HZ = 50;

/** Fixed physics delta time in ms */
export const PHYSICS_DT_MS = 1000 / PHYSICS_TICK_HZ;

/** Maximum physics catch-up steps per render frame (prevents spiral of death) */
export const MAX_PHYSICS_STEPS_PER_FRAME = 3;

// ─── Lander Physics ───────────────────────────────────────────────────────────

/** Main thruster force in Newtons (applied per physics tick) */
export const THRUSTER_FORCE_N = 200_000;

/** RCS (rotation) torque in Newton-meters */
export const RCS_TORQUE_NM = 50_000;

/** Base fuel capacity in kg (hydrazine equivalent) */
export const BASE_FUEL_CAPACITY_KG = 2000;

/** Fuel consumption rate at full thrust (kg/s) */
export const FUEL_CONSUMPTION_RATE = 40;

/** Minimum thrust level (idle RCS firing, 5% of max) */
export const MIN_THRUST_LEVEL = 0.05;

// ─── Payload Physics Profiles ─────────────────────────────────────────────────

export interface PayloadPhysicsProfile {
  /** Kg */
  mass: number;
  /** 0.1 = aerodynamic dart, 2.4 = sail/parachute effect */
  dragCoefficient: number;
  /** m/s — downward velocity that won't damage the module */
  impactTolerance: number;
  /** Pixel width for collision body */
  widthPx: number;
  /** Pixel height for collision body */
  heightPx: number;
}

export const PAYLOAD_PROFILES: Record<string, PayloadPhysicsProfile> = {
  titanium_foundation: {
    mass: 8400,
    dragCoefficient: 0.3,
    impactTolerance: 12.0,
    widthPx: 80,
    heightPx: 40,
  },
  solar_array: {
    mass: 1200,
    dragCoefficient: 2.4,
    impactTolerance: 4.5,
    widthPx: 120,
    heightPx: 20,
  },
  crew_habitat: {
    mass: 3200,
    dragCoefficient: 0.8,
    impactTolerance: 7.0,
    widthPx: 70,
    heightPx: 60,
  },
  fission_reactor: {
    mass: 12000,
    dragCoefficient: 0.45,
    impactTolerance: 8.0,
    widthPx: 65,
    heightPx: 80,
  },
  hydroponics_dome: {
    mass: 900,
    dragCoefficient: 1.1,
    impactTolerance: 2.5,
    widthPx: 90,
    heightPx: 55,
  },
  deep_core_drill: {
    mass: 5500,
    dragCoefficient: 0.22,
    impactTolerance: 6.0,
    widthPx: 40,
    heightPx: 100,
  },
  shock_absorber_strut: {
    mass: 400,
    dragCoefficient: 0.35,
    impactTolerance: 999,
    widthPx: 30,
    heightPx: 60,
  },
  science_lab: {
    mass: 2800,
    dragCoefficient: 0.65,
    impactTolerance: 5.5,
    widthPx: 75,
    heightPx: 65,
  },
  robotics_hub: {
    mass: 3100,
    dragCoefficient: 0.7,
    impactTolerance: 6.5,
    widthPx: 70,
    heightPx: 70,
  },
  water_extractor: {
    mass: 2000,
    dragCoefficient: 0.55,
    impactTolerance: 6.0,
    widthPx: 60,
    heightPx: 50,
  },
  battery_bank: {
    mass: 1800,
    dragCoefficient: 0.4,
    impactTolerance: 8.0,
    widthPx: 65,
    heightPx: 45,
  },
  anchor_project: {
    mass: 45000,
    dragCoefficient: 0.6,
    impactTolerance: 5.0,
    widthPx: 200,
    heightPx: 120,
  },
};

// ─── Impact Damage Formula ─────────────────────────────────────────────────────

/**
 * Calculate damage percentage from impact velocity.
 *
 * impactDamage = clamp((velocity - tolerance) / tolerance, 0, 1) × 100
 *
 * @param velocityMs - Downward velocity at contact in m/s
 * @param toleranceMs - Module's impact tolerance in m/s
 * @returns Damage percentage [0–100]
 */
export function calculateImpactDamage(velocityMs: number, toleranceMs: number): number {
  if (velocityMs <= toleranceMs) return 0;
  const excess = (velocityMs - toleranceMs) / toleranceMs;
  return Math.min(excess * 100, 100);
}

// ─── Drop Bounty Formula ──────────────────────────────────────────────────────

/**
 * Calculate the Drop Bounty payout for a successful landing.
 *
 * bounty = baseBounty × velocityScore × fuelScore × softnessScore
 */
export function calculateDropBounty(params: {
  baseCost: number;
  maxDescentVelocity: number;
  fuelRemaining: number; // [0–1]
  impactVelocity: number; // m/s
  impactTolerance: number; // m/s
}): number {
  const baseBounty = params.baseCost * 0.15;

  // Faster descent = higher risk taken = higher payout (capped at 2×)
  const velocityScore = Math.min(Math.max(params.maxDescentVelocity / 50.0, 0.5), 2.0);

  // More fuel remaining = more efficient = higher payout
  const fuelScore = 0.7 + params.fuelRemaining * 0.6;

  // Softer landing = higher score (up to 1.5× for perfect landing)
  const softnessFraction = Math.max(0, 1 - params.impactVelocity / params.impactTolerance);
  const softnessScore = 1.0 + Math.min(softnessFraction, 0.5);

  return Math.round(baseBounty * velocityScore * fuelScore * softnessScore);
}

// ─── Atmosphere ───────────────────────────────────────────────────────────────

/** Atmospheric density factor per planet [0=vacuum, 1=Earth-like] */
export const ATMOSPHERE_DENSITY: Record<string, number> = {
  luna_prime: 0.0,
  serpentine_rifts: 0.08,
  thalassa: 0.95,
  zephyrus: 0.85, // upper atmosphere where platform floats
  the_outer_dark: 0.0,
  vulcanis: 0.7,
};

/**
 * Calculate atmospheric drag force on the lander.
 *
 * F_drag = 0.5 × ρ × v² × Cd × A
 * Simplified for game: F_drag = atmosphericDensity × velocity² × dragCoef × scaleFactor
 */
export function calculateAtmosphericDrag(
  velocityMs: number,
  dragCoefficient: number,
  atmosphericDensity: number,
): number {
  const DRAG_SCALE = 80; // tuned game constant
  return atmosphericDensity * velocityMs * velocityMs * dragCoefficient * DRAG_SCALE;
}
