/**
 * PhysicsWorld — Matter.js engine wrapper with fixed-rate tick.
 *
 * Runs the physics simulation at a constant PHYSICS_TICK_HZ (50Hz = 20ms steps),
 * completely decoupled from the PixiJS render frame rate. This ensures that
 * lander physics behave identically on a 30fps mobile device and a 120fps desktop.
 *
 * Usage:
 *   const world = new PhysicsWorld(1.62); // Luna Prime gravity
 *   world.addBody(landerBody);
 *   world.addBody(terrainBody);
 *   // In PixiJS ticker:
 *   world.step(ticker.deltaMS);
 */

import Matter from "matter-js";
import {
  PHYSICS_DT_MS,
  MAX_PHYSICS_STEPS_PER_FRAME,
  PIXELS_PER_METER,
} from "../../constants/physics";

export class PhysicsWorld {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;

  private accumulator = 0;

  constructor(gravityMs2: number) {
    this.engine = Matter.Engine.create({
      gravity: {
        x: 0,
        // Matter.js gravity.y is in pixels/ms² scaled by the engine's scale
        // We configure via the World gravity object
        y: 1,
        scale: (gravityMs2 / 1000) * PIXELS_PER_METER,
      },
    });

    this.world = this.engine.world;
  }

  /** Add a body to the physics world */
  addBody(body: Matter.Body): void {
    Matter.Composite.add(this.world, body);
  }

  /** Remove a body from the physics world */
  removeBody(body: Matter.Body): void {
    Matter.Composite.remove(this.world, body);
  }

  /**
   * Step the physics simulation.
   * Called from PixiJS ticker with deltaMS (time elapsed since last frame).
   * Uses a fixed-step accumulator pattern to maintain deterministic physics.
   */
  step(deltaMS: number): void {
    this.accumulator += deltaMS;

    let steps = 0;
    while (this.accumulator >= PHYSICS_DT_MS && steps < MAX_PHYSICS_STEPS_PER_FRAME) {
      Matter.Engine.update(this.engine, PHYSICS_DT_MS);
      this.accumulator -= PHYSICS_DT_MS;
      steps++;
    }

    // Clamp accumulator to prevent spiral of death on very slow devices
    if (this.accumulator > PHYSICS_DT_MS * MAX_PHYSICS_STEPS_PER_FRAME) {
      this.accumulator = 0;
    }
  }

  /**
   * Apply wind force to a body each physics tick.
   * Wind force = atmosphericDensity × windSpeedMs² × dragCoeff × bodyWidth
   */
  applyWind(body: Matter.Body, windForceX: number): void {
    Matter.Body.applyForce(body, body.position, { x: windForceX, y: 0 });
  }

  /** Destroy the physics world and engine (cleanup) */
  destroy(): void {
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
  }
}
