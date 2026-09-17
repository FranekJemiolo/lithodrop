/**
 * LanderBody — Matter.js rigid body for the lander + payload.
 *
 * The lander's physics body is a compound body: the lander hull sits on top,
 * the payload module hangs below. The combined center of mass is calculated
 * from both masses, which affects rotational inertia and stability.
 *
 * Aerodynamic drag is applied manually each tick by DescendPhaseSystem
 * based on the payload's drag coefficient and the current atmosphere.
 */

import Matter from "matter-js";
import { PAYLOAD_PROFILES } from "../../constants/physics";
import type { ModuleType } from "../grid/types";

// Lander hull constants (fixed for all payloads)
const LANDER_HULL_MASS_KG = 800;
const LANDER_HULL_WIDTH_PX = 50;
const LANDER_HULL_HEIGHT_PX = 35;

export interface LanderBodyOptions {
  moduleType: ModuleType;
  startX: number;
  startY: number;
}

export interface LanderBodyState {
  body: Matter.Body;
  moduleType: ModuleType;
  fuelKg: number;
  maxFuelKg: number;
  hullHealth: number;
  maxDescentVelocity: number; // tracks peak downward velocity during descent
  isAlive: boolean;
}

/** Create a Matter.js lander body for the given payload type */
export function createLanderBody(options: LanderBodyOptions): LanderBodyState {
  const profile = PAYLOAD_PROFILES[options.moduleType];
  if (!profile) {
    throw new Error(`LanderBody: Unknown module type "${options.moduleType}"`);
  }

  // Compound body: lander hull on top, payload below
  const hullBody = Matter.Bodies.rectangle(
    options.startX,
    options.startY - profile.heightPx / 2,
    LANDER_HULL_WIDTH_PX,
    LANDER_HULL_HEIGHT_PX,
    { label: "lander-hull" },
  );

  const payloadBody = Matter.Bodies.rectangle(
    options.startX,
    options.startY + LANDER_HULL_HEIGHT_PX / 2,
    profile.widthPx,
    profile.heightPx,
    { label: "lander-payload" },
  );

  // Combine into a single rigid compound body
  const compound = Matter.Body.create({
    parts: [hullBody, payloadBody],
    label: "lander",
    frictionAir: 0, // We apply drag manually for more control
    restitution: 0.05, // Very slight bounce on landing
    collisionFilter: { category: 0x0001, mask: 0x0002 }, // lander vs. terrain
  });

  // Set combined mass based on payload + hull
  const totalMass = (LANDER_HULL_MASS_KG + profile.mass) / 1000; // Matter.js uses arbitrary units
  Matter.Body.setMass(compound, totalMass);

  // Place at start position
  Matter.Body.setPosition(compound, { x: options.startX, y: options.startY });

  const BASE_FUEL_KG = 2000;

  return {
    body: compound,
    moduleType: options.moduleType,
    fuelKg: BASE_FUEL_KG,
    maxFuelKg: BASE_FUEL_KG,
    hullHealth: 100,
    maxDescentVelocity: 0,
    isAlive: true,
  };
}

/**
 * Apply main thruster force to the lander body.
 * Force direction is opposite to the lander's current angle (thrust through engine nozzle).
 *
 * @param state - Lander body state
 * @param throttle - [0–1] throttle level
 * @param thrusterForceN - Maximum force in Newtons
 * @param fuelConsumptionRate - kg/s at full throttle
 * @param dtSeconds - Time step in seconds
 * @returns Updated lander state (fuel consumed)
 */
export function applyThrust(
  state: LanderBodyState,
  throttle: number,
  thrusterForceN: number,
  fuelConsumptionRate: number,
  dtSeconds: number,
): LanderBodyState {
  if (state.fuelKg <= 0 || !state.isAlive || throttle <= 0) {
    return { ...state, fuelKg: Math.max(0, state.fuelKg) };
  }

  const angle = state.body.angle;
  // Thrust direction: opposite to lander's "down" vector (engine points down)
  const thrustX = -Math.sin(angle) * thrusterForceN * throttle;
  const thrustY = -Math.cos(angle) * thrusterForceN * throttle;

  Matter.Body.applyForce(state.body, state.body.position, {
    x: thrustX / 1_000_000, // Scale to Matter.js force units
    y: thrustY / 1_000_000,
  });

  // Consume fuel
  const fuelConsumed = fuelConsumptionRate * throttle * dtSeconds;
  const newFuel = Math.max(0, state.fuelKg - fuelConsumed);

  return { ...state, fuelKg: newFuel };
}

/**
 * Apply RCS rotation torque to the lander body.
 *
 * @param direction - -1 (counterclockwise) or +1 (clockwise)
 * @param torqueNm - Torque magnitude in Newton-meters
 */
export function applyRCS(
  body: Matter.Body,
  direction: -1 | 0 | 1,
  torqueNm: number,
): void {
  if (direction === 0) return;
  // Matter.js torque: positive = clockwise
  body.torque += (direction * torqueNm) / 1_000_000;
}

/**
 * Apply atmospheric drag force opposing velocity.
 */
export function applyAtmosphericDrag(
  body: Matter.Body,
  dragCoefficient: number,
  atmosphericDensity: number,
): void {
  if (atmosphericDensity <= 0) return;

  const vel = body.velocity;
  const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
  if (speed < 0.001) return;

  const DRAG_SCALE = 0.00005;
  const dragMagnitude = atmosphericDensity * speed * speed * dragCoefficient * DRAG_SCALE;

  Matter.Body.applyForce(body, body.position, {
    x: -(vel.x / speed) * dragMagnitude,
    y: -(vel.y / speed) * dragMagnitude,
  });
}

/** Get the downward velocity (m/s equivalent) from the body's velocity */
export function getDownwardVelocity(body: Matter.Body): number {
  // Positive Y is downward in PixiJS/Matter.js screen space
  return body.velocity.y;
}
