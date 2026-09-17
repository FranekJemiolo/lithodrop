/**
 * TelemetryReticle — Circular HUD element that tracks with the lander.
 *
 * Renders as a PixiJS Container positioned at the lander's screen coordinates.
 * Components:
 *   - Left arc: fuel remaining (plasma cyan → dim gray)
 *   - Right arc: hull integrity (colony green → danger red)
 *   - Center vector line: velocity direction and magnitude
 *     green (safe) → yellow (caution) → red (critical)
 *   - Altitude readout: mono text below the reticle
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { LanderBodyState } from "../physics/LanderBody";

const RETICLE_RADIUS = 55;
const ARC_WIDTH = 4;

export class TelemetryReticle {
  readonly container: Container;
  private readonly arcs: Graphics;
  private readonly velocityVector: Graphics;
  private readonly altText: Text;

  constructor() {
    this.container = new Container();

    this.arcs = new Graphics();
    this.velocityVector = new Graphics();

    this.altText = new Text({
      text: "ALT: --",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 11,
        fontWeight: "400",
        fill: 0x8b9ab5,
      }),
    });
    this.altText.anchor.set(0.5, 0);
    this.altText.y = RETICLE_RADIUS + 8;

    this.container.addChild(this.velocityVector);
    this.container.addChild(this.arcs);
    this.container.addChild(this.altText);
  }

  /**
   * Update the reticle visual state from lander telemetry.
   *
   * @param state - Current lander body state
   * @param impactTolerance - Module's impact tolerance in m/s
   * @param surfaceY - Y pixel position of terrain directly below
   */
  update(state: LanderBodyState, impactTolerance: number, surfaceY: number): void {
    this.container.x = state.body.position.x;
    this.container.y = state.body.position.y;

    const fuelFraction = state.fuelKg / state.maxFuelKg;
    const healthFraction = state.hullHealth / 100;

    this.drawArcs(fuelFraction, healthFraction);
    this.drawVelocityVector(state, impactTolerance);
    this.updateAltText(state.body.position.y, surfaceY);
  }

  private drawArcs(fuelFraction: number, healthFraction: number): void {
    const g = this.arcs;
    g.clear();

    const R = RETICLE_RADIUS;

    // Outer dim ring (background track)
    g.arc(0, 0, R, -Math.PI, Math.PI);
    g.stroke({ color: 0x1a2a3a, width: ARC_WIDTH + 1 });

    // Left arc = fuel (from 180° to -180° counterclockwise)
    // Left side: from top (270°) going counterclockwise through left to bottom
    const fuelStartAngle = -Math.PI / 2; // top
    const fuelEndAngle = fuelStartAngle - Math.PI * fuelFraction; // CCW

    const fuelColor = fuelFraction > 0.3 ? 0x00d4ff : fuelFraction > 0.15 ? 0xffd700 : 0xff2d2d;

    g.arc(0, 0, R, fuelEndAngle, fuelStartAngle);
    g.stroke({ color: fuelColor, width: ARC_WIDTH, alpha: 0.9 });

    // Right arc = hull health (from top going clockwise through right to bottom)
    const healthStartAngle = -Math.PI / 2;
    const healthEndAngle = healthStartAngle + Math.PI * healthFraction;

    const healthColor =
      healthFraction > 0.6 ? 0x39ff6b : healthFraction > 0.3 ? 0xffd700 : 0xff2d2d;

    g.arc(0, 0, R, healthStartAngle, healthEndAngle);
    g.stroke({ color: healthColor, width: ARC_WIDTH, alpha: 0.9 });

    // Center dot
    g.circle(0, 0, 3);
    g.fill({ color: 0x8b9ab5, alpha: 0.6 });
  }

  private drawVelocityVector(state: LanderBodyState, impactTolerance: number): void {
    const g = this.velocityVector;
    g.clear();

    const vel = state.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (speed < 0.5) return;

    // Vector points in direction of travel, length = speed (capped at 60px)
    const vectorLength = Math.min(speed * 3, 60);
    const angle = Math.atan2(vel.y, vel.x);
    const endX = Math.cos(angle) * vectorLength;
    const endY = Math.sin(angle) * vectorLength;

    // Color: green safe, yellow caution, red critical
    const downVelMs = Math.max(0, vel.y) * 0.05; // rough m/s conversion
    const dangerRatio = downVelMs / impactTolerance;
    const vectorColor = dangerRatio < 0.5 ? 0x39ff6b : dangerRatio < 0.8 ? 0xffd700 : 0xff2d2d;

    g.moveTo(0, 0);
    g.lineTo(endX, endY);
    g.stroke({ color: vectorColor, width: 2.5, alpha: 0.85 });

    // Arrowhead
    g.circle(endX, endY, 3);
    g.fill({ color: vectorColor });
  }

  private updateAltText(landerY: number, surfaceY: number): void {
    const altPixels = Math.max(0, surfaceY - landerY);
    const altMeters = Math.round(altPixels / 2); // 1px = 0.5m
    this.altText.text = `ALT ${altMeters}m`;
  }
}
