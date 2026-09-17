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
import { techTree } from "../progression/TechTree";
import type { InputSystem } from "./InputSystem";
import {
  PAYLOAD_PROFILES,
  THRUSTER_FORCE_N,
  RCS_TORQUE_NM,
  FUEL_CONSUMPTION_RATE,
  calculateImpactDamage,
  calculateDropBounty,
  ATMOSPHERE_DENSITY,
  pixelsToMeters,
} from "../../constants/physics";
import type { ModuleType } from "../grid/types";

import type { HazardSystem } from "../physics/HazardSystem";
import { TelemetryTracker, type TelemetryData } from "../physics/TelemetryTracker";
import { specialContracts } from "../progression/SpecialContracts";

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
  private readonly hazardSystem?: HazardSystem;
  private readonly surfaceY?: number;
  readonly telemetryTracker = new TelemetryTracker();
  private landed = false;

  constructor(
    physicsWorld: PhysicsWorld,
    input: InputSystem,
    landerState: LanderBodyState,
    planetId: string,
    hazardSystem?: HazardSystem,
    surfaceY?: number,
  ) {
    this.physicsWorld = physicsWorld;
    this.input = input;
    this.landerState = landerState;
    this.planetId = planetId;
    this.hazardSystem = hazardSystem;
    this.surfaceY = surfaceY;

    // Listen for Matter.js collision events
    Matter.Events.on(this.physicsWorld.engine, "collisionStart", this.onCollisionStart);
  }

  /** Called from PixiJS ticker each frame */
  update(ticker: Ticker): void {
    if (this.landed || !this.landerState.isAlive) return;

    this.input.beginFrame();
    const inputState = this.input.getState();
    const dtSeconds = ticker.deltaMS / 1000;

    const mods = techTree.getModifiers();
    const effectiveThrust = THRUSTER_FORCE_N * mods.thrusterForceMultiplier;
    const effectiveFuelRate = FUEL_CONSUMPTION_RATE * mods.fuelConsumptionMultiplier;
    const effectiveTorque = RCS_TORQUE_NM * mods.rcsTorqueMultiplier;

    // Apply thrust
    if (inputState.thrust > 0) {
      this.landerState = applyThrust(
        this.landerState,
        inputState.thrust,
        effectiveThrust,
        effectiveFuelRate,
        dtSeconds,
      );
    }

    // Apply RCS rotation
    applyRCS(this.landerState.body, inputState.rotation, effectiveTorque);

    // Apply atmospheric drag
    const atmosphericDensity = ATMOSPHERE_DENSITY[this.planetId] ?? 0;
    const profile = PAYLOAD_PROFILES[this.landerState.moduleType];
    if (profile && atmosphericDensity > 0) {
      applyAtmosphericDrag(this.landerState.body, profile.dragCoefficient, atmosphericDensity);
    }

    // Apply planetary environmental hazards
    if (this.hazardSystem) {
      const hazardRes = this.hazardSystem.update(this.landerState, dtSeconds, this.landed);
      this.landerState = hazardRes.state;
    }

    // Step physics
    this.physicsWorld.step(ticker.deltaMS);

    // Track telemetry (acceleration, G-force, tilt) and check VIP contracts
    this.telemetryTracker.update(
      this.landerState.body,
      dtSeconds,
      specialContracts.getActiveVipContract(),
    );

    // Track max descent velocity
    const downVel = getDownwardVelocity(this.landerState.body);
    if (downVel > this.landerState.maxDescentVelocity) {
      this.landerState = { ...this.landerState, maxDescentVelocity: downVel };
    }

    // Anti-tunneling boundary safeguard: if high downward velocity penetrates surface level
    if (this.surfaceY !== undefined && this.landerState.body.position.y >= this.surfaceY + 25) {
      this.handleTouchdown();
    }
  }

  /** Get current lander state (for HUD rendering) */
  getLanderState(): Readonly<LanderBodyState> {
    return this.landerState;
  }

  /** Get current telemetry data */
  getTelemetry(): TelemetryData {
    return this.telemetryTracker.getData();
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
    if (this.landed) return;
    this.landed = true;

    // Read impact velocity BEFORE zeroing out velocity
    const impactVelocity = Math.max(0, getDownwardVelocity(this.landerState.body));

    // Convert from pixel velocity to m/s
    const impactMs = pixelsToMeters(impactVelocity);

    // Immediately zero out velocity upon surface contact to prevent sinking
    Matter.Body.setVelocity(this.landerState.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.landerState.body, 0);

    // If penetrating beyond surface, clamp position to prevent sinking
    if (this.surfaceY !== undefined && this.landerState.body.position.y > this.surfaceY + 10) {
      Matter.Body.setPosition(this.landerState.body, {
        x: this.landerState.body.position.x,
        y: this.surfaceY + 10,
      });
    }

    const profile = PAYLOAD_PROFILES[this.landerState.moduleType];
    const mods = techTree.getModifiers();
    const baseTolerance = profile?.impactTolerance ?? 5;
    const effectiveTolerance = baseTolerance * mods.impactToleranceMultiplier;

    const impactDamage = calculateImpactDamage(impactMs, effectiveTolerance);
    const survived = impactDamage < 100;

    if (!survived) {
      this.landerState = { ...this.landerState, isAlive: false, hullHealth: 0 };
    }

    const bounty = survived
      ? calculateDropBounty({
          baseCost: DEFAULT_MODULE_COST[this.landerState.moduleType] ?? 1000,
          maxDescentVelocity: this.landerState.maxDescentVelocity,
          fuelRemaining: this.landerState.fuelKg / this.landerState.maxFuelKg,
          impactVelocity: impactMs,
          impactTolerance: effectiveTolerance,
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
