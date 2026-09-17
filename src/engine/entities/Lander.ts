/**
 * Lander entity — PixiJS Container for the lander visual.
 *
 * Renders a chunky industrial lander silhouette using PixiJS Graphics
 * (no external sprite sheet required for M2 — programmatic art).
 * Syncs its position and rotation from the Matter.js body each frame.
 *
 * Children:
 *   - hull graphics (trapezoid body, landing legs)
 *   - payload graphics (rectangle with module-specific color)
 *   - thruster plume particles (from ThrusterPlume)
 */

import { Container, Graphics } from "pixi.js";
import type { LanderBodyState } from "../physics/LanderBody";
import type { ModuleType } from "../grid/types";

// Module color coding
const MODULE_COLORS: Record<string, number> = {
  titanium_foundation: 0x5a6a80,
  solar_array: 0xffd700,
  crew_habitat: 0xff6b2b,
  fission_reactor: 0xff2d2d,
  hydroponics_dome: 0x39ff6b,
  deep_core_drill: 0x8b9ab5,
  shock_absorber_strut: 0x4a5a6a,
  science_lab: 0x00d4ff,
  robotics_hub: 0x9966ff,
  water_extractor: 0x0099cc,
  battery_bank: 0xffaa00,
  thermal_generator: 0xff4400,
  comms_relay: 0x44ffaa,
  anchor_project: 0xffffff,
};

export class LanderEntity {
  readonly container: Container;
  private readonly hullGraphics: Graphics;
  private readonly payloadGraphics: Graphics;
  private readonly plume: Graphics;
  private readonly heatHaze: Graphics;
  private plumeTime = 0;

  // Impact deformation (squash & stretch) state
  private squashDurationMs = 0;
  private squashElapsedMs = 0;
  private squashIntensity = 0;
  private isSquashing = false;

  constructor(moduleType: ModuleType) {
    this.container = new Container();
    this.heatHaze = new Graphics();
    this.plume = new Graphics();
    this.hullGraphics = new Graphics();
    this.payloadGraphics = new Graphics();

    // Layer order: heat haze back → plume → payload → hull
    this.container.addChild(this.heatHaze);
    this.container.addChild(this.plume);
    this.container.addChild(this.payloadGraphics);
    this.container.addChild(this.hullGraphics);

    this.drawHull();
    this.drawPayload(moduleType);
  }

  private drawHull(): void {
    const g = this.hullGraphics;
    g.clear();

    // Hull body — industrial trapezoid
    g.moveTo(-22, -18);
    g.lineTo(22, -18);
    g.lineTo(18, 0);
    g.lineTo(-18, 0);
    g.closePath();
    g.fill({ color: 0x3a4a5a });
    g.stroke({ color: 0x5a7a9a, width: 1.5 });

    // Engine nozzle
    g.rect(-8, 0, 16, 12);
    g.fill({ color: 0x2a3a4a });
    g.stroke({ color: 0x00d4ff, width: 1, alpha: 0.6 });

    // Landing legs (folded down)
    // Left leg
    g.moveTo(-18, 0);
    g.lineTo(-28, 18);
    g.moveTo(-28, 18);
    g.lineTo(-22, 18);
    g.stroke({ color: 0x5a7a9a, width: 2 });

    // Right leg
    g.moveTo(18, 0);
    g.lineTo(28, 18);
    g.moveTo(28, 18);
    g.lineTo(22, 18);
    g.stroke({ color: 0x5a7a9a, width: 2 });

    // Thruster ring (glows when thrusting)
    g.circle(0, 6, 5);
    g.stroke({ color: 0x00d4ff, width: 1.5, alpha: 0.3 });
  }

  private drawPayload(moduleType: ModuleType): void {
    const g = this.payloadGraphics;
    g.clear();

    const color = MODULE_COLORS[moduleType] ?? 0x8b9ab5;

    // Payload module hangs below hull
    g.roundRect(-22, 18, 44, 30, 3);
    g.fill({ color, alpha: 0.9 });
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });

    // Module label stripe
    g.rect(-16, 20, 32, 5);
    g.fill({ color: 0x000000, alpha: 0.4 });

    // Magnetic dock indicator (bottom center)
    g.circle(0, 48, 4);
    g.fill({ color: 0x00d4ff, alpha: 0.5 });
  }

  /** Draw thruster plume & heat haze distortion (called each frame) */
  private updatePlume(thrust: number, deltaMS: number): void {
    this.plumeTime += deltaMS / 1000;
    const g = this.plume;
    const h = this.heatHaze;
    g.clear();
    h.clear();

    if (thrust <= 0) return;

    const plumeLength = 20 + thrust * 45 + Math.sin(this.plumeTime * 30) * 8;
    const plumeWidth = 6 + thrust * 5;

    // ── WebGL / Procedural Heat Haze Distortion ─────────────────────────────
    // High-temperature refractive ripples expanding outwards
    const hazeSteps = 6;
    const hazeLength = plumeLength * 1.8;
    for (let i = 0; i < hazeSteps; i++) {
      const stepT = i / hazeSteps;
      const waveY = 12 + stepT * hazeLength;
      const waveSpread = (plumeWidth + 12 * stepT) * (1 + thrust * 0.8);
      const waveOffset = Math.sin(this.plumeTime * 45 + i * 1.5) * (4 + thrust * 6);
      const alpha = (1 - stepT) * 0.22 * thrust;

      // Outer heat wave band
      h.moveTo(-waveSpread + waveOffset, waveY);
      h.lineTo(waveSpread + waveOffset, waveY);
      h.stroke({ color: 0x00d4ff, width: 3 + stepT * 4, alpha });

      // Core turbulence spark line
      h.moveTo(-waveSpread * 0.4 - waveOffset, waveY + 2);
      h.lineTo(waveSpread * 0.4 - waveOffset, waveY + 2);
      h.stroke({ color: 0xffaa00, width: 2, alpha: alpha * 1.2 });
    }

    // ── Core Plume ──────────────────────────────────────────────────────────
    // Hot white/cyan center
    g.moveTo(-plumeWidth * 0.3, 6);
    g.lineTo(plumeWidth * 0.3, 6);
    g.lineTo(0, 6 + plumeLength);
    g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.95 });

    // Outer flame (orange)
    g.moveTo(-plumeWidth, 6);
    g.lineTo(plumeWidth, 6);
    g.lineTo(0, 6 + plumeLength * 1.3);
    g.closePath();
    g.fill({ color: 0xff6b2b, alpha: 0.6 });

    // Outer atmospheric expansion glow (cyan)
    g.moveTo(-plumeWidth * 1.5, 6);
    g.lineTo(plumeWidth * 1.5, 6);
    g.lineTo(0, 6 + plumeLength * 1.6);
    g.closePath();
    g.fill({ color: 0x00d4ff, alpha: 0.25 });
  }

  /** Trigger a brief (3-6 frames / ~120ms) impact squash & stretch deformation */
  triggerImpactSquash(impactVelocity: number, mass: number): void {
    this.squashIntensity = Math.min(0.45, Math.max(0.18, (impactVelocity / 14) * (mass / 8400)));
    this.squashDurationMs = 130;
    this.squashElapsedMs = 0;
    this.isSquashing = true;
  }

  private updateSquash(deltaMS: number): void {
    if (!this.isSquashing) {
      this.payloadGraphics.scale.set(1.0, 1.0);
      this.hullGraphics.scale.set(1.0, 1.0);
      return;
    }

    this.squashElapsedMs += deltaMS;
    const t = Math.min(1.0, this.squashElapsedMs / this.squashDurationMs);

    let sx = 1.0;
    let sy = 1.0;

    if (t < 0.35) {
      // Impact compression phase (squash down, stretch out)
      const p = Math.sin((t / 0.35) * (Math.PI / 2));
      sy = 1.0 - this.squashIntensity * p;
      sx = 1.0 + this.squashIntensity * p * 0.8;
    } else {
      // Rebound spring phase
      const reboundT = (t - 0.35) / 0.65;
      const decay = Math.exp(-reboundT * 3);
      const p = Math.cos(reboundT * Math.PI) * decay;
      sy = 1.0 - this.squashIntensity * p * 0.5;
      sx = 1.0 + this.squashIntensity * p * 0.4;
    }

    this.payloadGraphics.scale.set(sx, sy);
    this.hullGraphics.scale.set(sx, sy);

    if (t >= 1.0) {
      this.isSquashing = false;
      this.payloadGraphics.scale.set(1.0, 1.0);
      this.hullGraphics.scale.set(1.0, 1.0);
    }
  }

  /** Sync visual position/rotation from Matter.js body state */
  syncFromPhysics(state: LanderBodyState, thrust: number, deltaMS: number): void {
    this.container.x = state.body.position.x;
    this.container.y = state.body.position.y;
    this.container.rotation = state.body.angle;
    this.updatePlume(thrust, deltaMS);
    this.updateSquash(deltaMS);
  }
}
