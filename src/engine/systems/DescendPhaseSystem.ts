/**
 * DescendPhaseSystem — Orchestrates the lander descent game loop.
 *
 * Each PixiJS ticker frame:
 *   1. Reads InputSystem state
 *   2. Applies thrust forces to LanderBody
 *   3. Applies atmospheric drag
 *   4. Steps PhysicsWorld
 *   5. Detects terrain collision → evaluates impact, emits PAYLOAD_TOUCHDOWN
 *   6. Checks out-of-bounds (lander flew off screen)
 *
 * On touchdown, the system computes the Drop Bounty and hands off
 * to the BuildPhaseSystem by emitting the PAYLOAD_TOUCHDOWN event.
 */

import Matter from "matter-js";
import type { Ticker } from "pixi.js";
import { eventBus } from "../events/EventBus";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import {
  applyThrust,
  applyRCS,
  applyAtmosphericDrag,
  getDownwardVelocity,
  type LanderBodyState,
} from "../physics/LanderBody";
import type { InputSystem } from "./InputSystem";
import {
  PHYSICS_DT_MS,
  PAYLOAD_PROFILES,
  THRUSTER_FORCE_N,
  RCS_TORQUE_NM,
  FUEL_CONSUMPTION_RATE,
  calculateImpactDamage,
  calculateDropBounty,
  ATMOSPHERE_DENSITY,
} from "../../constants/physics";
import type { ModuleType } from "../grid/types";

const DEFAULT_MODULE_COST: Record<ModuleType, number> = {
  titanium_foundation: 800,
  solar_array: 1200,
  crew_habitat: 2500,
  fission_reactor: 8000,
  hydroponics_dome: 1500,
  deep_core_drill: 3500,
  shock_absorber_strut: 200,
  science_lab: 4000,
  robotics_hub: 3000,
  water_extractor: 1000,
  battery_bank: 600,
  thermal_generator: 2000,
  comms_relay: 1800,
  anchor_project: 50000,
};

export class DescendPhaseSystem {
  private readonly physicsWorld: PhysicsWorld;
  private readonly input: InputSystem;
  private landerState: LanderBodyState;
  private readonly planetId: string;
  private landed = false;

  constructor(
    physicsWorld: PhysicsWorld,
    input: InputSystem,
    landerState: LanderBodyState,
    planetId: string,
  ) {
    this.physicsWorld = physicsWorld;
    this.input = input;
    this.landerState = landerState;
    this.planetId = planetId;

    // Listen for Matter.js collision events
    Matter.Events.on(this.physicsWorld.engine, "collisionStart", this.onCollisionStart);
  }

  /** Called from PixiJS ticker each frame */
  update(ticker: Ticker): void {
    if (this.landed || !this.landerState.isAlive) return;

    this.input.beginFrame();
    const inputState = this.input.getState();
    const dtSeconds = ticker.deltaMS / 1000;

    // Apply thrust
    if (inputState.thrust > 0) {
      this.landerState = applyThrust(
        this.landerState,
        inputState.thrust,
        THRUSTER_FORCE_N,
        FUEL_CONSUMPTION_RATE,
        dtSeconds,
      );
    }

    // Apply RCS rotation
    applyRCS(this.landerState.body, inputState.rotation, RCS_TORQUE_NM);

    // Apply atmospheric drag
    const atmosphericDensity = ATMOSPHERE_DENSITY[this.planetId] ?? 0;
    const profile = PAYLOAD_PROFILES[this.landerState.moduleType];
    if (profile && atmosphericDensity > 0) {
      applyAtmosphericDrag(this.landerState.body, profile.dragCoefficient, atmosphericDensity);
    }

    // Step physics
    this.physicsWorld.step(ticker.deltaMS);

    // Track max descent velocity
    const downVel = getDownwardVelocity(this.landerState.body);
    if (downVel > this.landerState.maxDescentVelocity) {
      this.landerState = { ...this.landerState, maxDescentVelocity: downVel };
    }
  }

  /** Get current lander state (for HUD rendering) */
  getLanderState(): Readonly<LanderBodyState> {
    return this.landerState;
  }

  private readonly onCollisionStart = (event: Matter.IEventCollision<Matter.Engine>): void => {
    if (this.landed) return;

    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;

      const isLanderTerrain =
        (bodyA.label.startsWith("lander") && bodyB.label.startsWith("terrain")) ||
        (bodyB.label.startsWith("lander") && bodyA.label.startsWith("terrain"));

      if (!isLanderTerrain) continue;

      this.handleTouchdown();
      break;
    }
  };

  private handleTouchdown(): void {
    this.landed = true;

    const profile = PAYLOAD_PROFILES[this.landerState.moduleType];
    const impactVelocity = Math.max(0, getDownwardVelocity(this.landerState.body));

    // Convert from pixel velocity to m/s (rough approximation)
    const impactMs = impactVelocity * (PHYSICS_DT_MS / 1000) * 2;

    const impactDamage = calculateImpactDamage(impactMs, profile?.impactTolerance ?? 5);
    const survived = impactDamage < 100;

    const bounty = survived
      ? calculateDropBounty({
          baseCost: DEFAULT_MODULE_COST[this.landerState.moduleType] ?? 1000,
          maxDescentVelocity: this.landerState.maxDescentVelocity,
          fuelRemaining: this.landerState.fuelKg / this.landerState.maxFuelKg,
          impactVelocity: impactMs,
          impactTolerance: profile?.impactTolerance ?? 5,
        })
      : 0;

    eventBus.emit("PAYLOAD_TOUCHDOWN", {
      velocity: impactMs,
      moduleType: this.landerState.moduleType,
      fuelRemaining: this.landerState.fuelKg / this.landerState.maxFuelKg,
      survived,
      impactDamage,
    });

    console.log(
      `LithoDrop: Touchdown! velocity=${impactMs.toFixed(2)}m/s, ` +
        `damage=${impactDamage.toFixed(1)}%, survived=${survived}, bounty=${bounty}cr`,
    );
  }

  destroy(): void {
    Matter.Events.off(this.physicsWorld.engine, "collisionStart", this.onCollisionStart);
  }
}
