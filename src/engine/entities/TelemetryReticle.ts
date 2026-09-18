/**
 * TelemetryReticle — Circular HUD & Flight Director element tracking the lander.
 *
 * Components:
 *   - Circular status arcs: fuel (left CCW) and hull health (right CW)
 *   - Ground Direction & Altitude Arrow:
 *       Points from the spacecraft in the direction of flight toward the terrain,
 *       showing the exact ground intercept point, distance in meters, and touchdown target.
 *       Color-coded by safe vs critical descent speed.
 *   - Distance Badge:
 *       Floating pill badge displaying distance to ground (e.g. "▼ 124m") and vertical speed.
 *   - Projected Touchdown Reticle:
 *       Landing zone bracket projected onto the terrain surface showing where the lander will touch down.
 *   - Altitude Gauge Ribbon:
 *       Vertical tape indicating distance above terrain with low-altitude touchdown alert.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { LanderBodyState } from "../physics/LanderBody";
import { getTerrainHeightAtX } from "../physics/TerrainBody";

const RETICLE_RADIUS = 55;
const ARC_WIDTH = 4;

export class TelemetryReticle {
  readonly container: Container;
  private readonly arcs: Graphics;
  private readonly velocityVector: Graphics;
  private readonly altitudeDirector: Graphics;
  private readonly badgeBg: Graphics;
  private readonly distanceText: Text;
  private readonly statusText: Text;
  private readonly altitudeTape: Graphics;
  private readonly altText: Text;

  private blinkTimer = 0;

  constructor() {
    this.container = new Container();

    this.altitudeDirector = new Graphics();
    this.velocityVector = new Graphics();
    this.arcs = new Graphics();
    this.altitudeTape = new Graphics();
    this.badgeBg = new Graphics();

    // Distance Badge Text (e.g. "▼ 124m")
    this.distanceText = new Text({
      text: "▼ --m",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 12,
        fontWeight: "700",
        fill: 0x00d4ff,
        letterSpacing: 1,
      }),
    });
    this.distanceText.anchor.set(0.5, 0.5);

    // Status / Speed Subtitle (e.g. "↓ 3.2m/s • SAFE")
    this.statusText = new Text({
      text: "SAFE",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 9,
        fontWeight: "600",
        fill: 0x39ff6b,
        letterSpacing: 0.5,
      }),
    });
    this.statusText.anchor.set(0.5, 0.5);

    // Altitude Text beneath the altitude tape
    this.altText = new Text({
      text: "220m",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 9,
        fontWeight: "600",
        fill: 0x8b9ab5,
        letterSpacing: 0.5,
      }),
    });
    this.altText.anchor.set(0.5, 0);
    this.altText.x = RETICLE_RADIUS + 17;
    this.altText.y = 44;

    // Display hierarchy (lowest to highest)
    this.container.addChild(this.altitudeDirector);
    this.container.addChild(this.velocityVector);
    this.container.addChild(this.arcs);
    this.container.addChild(this.altitudeTape);
    this.container.addChild(this.badgeBg);
    this.container.addChild(this.distanceText);
    this.container.addChild(this.statusText);
    this.container.addChild(this.altText);
  }

  /**
   * Update the reticle visual state from lander telemetry and terrain heightmap.
   *
   * @param state - Current lander body state
   * @param impactTolerance - Module's impact tolerance in m/s
   * @param surfaceY - Default baseline Y pixel position of terrain
   * @param heightmap - Optional array of terrain height samples
   * @param sampleStep - Optional pixel step between height samples
   */
  update(
    state: LanderBodyState,
    impactTolerance: number,
    surfaceY: number,
    heightmap?: number[],
    sampleStep?: number,
  ): void {
    const lx = state.body.position.x;
    const ly = state.body.position.y;
    this.container.x = lx;
    this.container.y = ly;

    const fuelFraction = state.fuelKg / state.maxFuelKg;
    const healthFraction = state.hullHealth / 100;
    this.blinkTimer += 0.05;

    // 1. Draw fuel & health arcs
    this.drawArcs(fuelFraction, healthFraction);

    // 2. Draw ground direction flight arrow & touchdown reticle
    this.drawAltitudeDirector(state, impactTolerance, surfaceY, heightmap, sampleStep);

    // 3. Draw vertical velocity vector inside reticle
    this.drawVelocityVector(state, impactTolerance);

    // 4. Draw altitude tape and textual readouts
    this.drawAltitudeTapeAndText(state, surfaceY, heightmap, sampleStep, impactTolerance);
  }

  private drawArcs(fuelFraction: number, healthFraction: number): void {
    const g = this.arcs;
    g.clear();

    const R = RETICLE_RADIUS;

    // Outer dim ring (background track)
    g.arc(0, 0, R, -Math.PI, Math.PI);
    g.stroke({ color: 0x1a2a3a, width: ARC_WIDTH + 1 });

    // Left arc = fuel (from top CCW to bottom)
    const fuelStartAngle = -Math.PI / 2;
    const fuelEndAngle = fuelStartAngle - Math.PI * Math.max(0, Math.min(1, fuelFraction));
    const fuelColor = fuelFraction > 0.3 ? 0x00d4ff : fuelFraction > 0.15 ? 0xffd700 : 0xff2d2d;

    g.arc(0, 0, R, fuelEndAngle, fuelStartAngle);
    g.stroke({ color: fuelColor, width: ARC_WIDTH, alpha: 0.9 });

    // Right arc = hull health (from top CW to bottom)
    const healthStartAngle = -Math.PI / 2;
    const healthEndAngle = healthStartAngle + Math.PI * Math.max(0, Math.min(1, healthFraction));
    const healthColor =
      healthFraction > 0.6 ? 0x39ff6b : healthFraction > 0.3 ? 0xffd700 : 0xff2d2d;

    g.arc(0, 0, R, healthStartAngle, healthEndAngle);
    g.stroke({ color: healthColor, width: ARC_WIDTH, alpha: 0.9 });

    // Center dot
    g.circle(0, 0, 3);
    g.fill({ color: 0x8b9ab5, alpha: 0.6 });
  }

  private drawAltitudeDirector(
    state: LanderBodyState,
    impactTolerance: number,
    surfaceY: number,
    heightmap?: number[],
    sampleStep?: number,
  ): void {
    const g = this.altitudeDirector;
    const bg = this.badgeBg;
    g.clear();
    bg.clear();

    const vel = state.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    const downVelMs = Math.max(0, vel.y) * 0.05;
    const dangerRatio = downVelMs / impactTolerance;

    // Status color
    const isCritical = dangerRatio >= 1.0;
    const isCaution = dangerRatio >= 0.65 && !isCritical;
    const vectorColor = isCritical ? 0xff2d2d : isCaution ? 0xffd700 : 0x00d4ff;

    // Determine flight direction unit vector (ux, uy)
    let ux = 0;
    let uy = 1; // Default downward

    if (vel.y > 0.2 && speed > 0.3) {
      ux = vel.x / speed;
      uy = vel.y / speed;
    }

    const startX = state.body.position.x;
    const startY = state.body.position.y;

    // Find ray intercept with terrain
    let tIntercept = 400; // fallback length
    let targetWorldX = startX + ux * tIntercept;
    let targetWorldY = startY + uy * tIntercept;

    const maxSteps = 40;
    const stepSize = 15;
    let foundIntercept = false;

    for (let step = 1; step <= maxSteps; step++) {
      const curT = step * stepSize;
      const testX = startX + ux * curT;
      const testY = startY + uy * curT;
      const groundY = getTerrainHeightAtX(heightmap, sampleStep, testX, surfaceY);

      if (testY >= groundY) {
        // Linear refinement between step-1 and step
        const prevT = (step - 1) * stepSize;
        const prevX = startX + ux * prevT;
        const prevY = startY + uy * prevT;
        const prevGroundY = getTerrainHeightAtX(heightmap, sampleStep, prevX, surfaceY);

        const dy1 = prevGroundY - prevY;
        const dy2 = testY - groundY;
        const denom = dy1 + dy2;
        const fraction = denom > 0 ? dy1 / denom : 0.5;

        tIntercept = prevT + fraction * stepSize;
        targetWorldX = startX + ux * tIntercept;
        targetWorldY = getTerrainHeightAtX(heightmap, sampleStep, targetWorldX, surfaceY);
        foundIntercept = true;
        break;
      }
    }

    if (!foundIntercept) {
      const groundYDirect = getTerrainHeightAtX(heightmap, sampleStep, startX, surfaceY);
      tIntercept = Math.max(40, groundYDirect - startY);
      targetWorldX = startX + ux * tIntercept;
      targetWorldY = startY + tIntercept;
    }

    // Local coordinates in container
    const localTargetX = targetWorldX - startX;
    const localTargetY = targetWorldY - startY;
    const distanceMeters = Math.max(0, Math.round(tIntercept / 2)); // 1px = 0.5m

    // Start arrow outside the reticle ring
    const originOffset = RETICLE_RADIUS + 4;
    const lineStartX = ux * originOffset;
    const lineStartY = uy * originOffset;

    // Draw trajectory arrow line towards ground
    const arrowAlpha = isCritical ? 0.7 + Math.sin(this.blinkTimer * 8) * 0.3 : 0.85;

    // Segmented dashed trajectory beam
    const totalDist = Math.sqrt(
      (localTargetX - lineStartX) ** 2 + (localTargetY - lineStartY) ** 2,
    );
    const segLen = 12;
    const gapLen = 6;
    let distCovered = 0;

    while (distCovered < totalDist - 10) {
      const p1 = distCovered / totalDist;
      const p2 = Math.min(1, (distCovered + segLen) / totalDist);

      const x1 = lineStartX + (localTargetX - lineStartX) * p1;
      const y1 = lineStartY + (localTargetY - lineStartY) * p1;
      const x2 = lineStartX + (localTargetX - lineStartX) * p2;
      const y2 = lineStartY + (localTargetY - lineStartY) * p2;

      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke({ color: vectorColor, width: isCritical ? 3 : 2, alpha: arrowAlpha });

      distCovered += segLen + gapLen;
    }

    // Arrowhead pointing towards ground
    const headAngle = Math.atan2(uy, ux);
    const headLen = 10;
    g.moveTo(localTargetX, localTargetY);
    g.lineTo(
      localTargetX - headLen * Math.cos(headAngle - 0.45),
      localTargetY - headLen * Math.sin(headAngle - 0.45),
    );
    g.lineTo(
      localTargetX - headLen * Math.cos(headAngle + 0.45),
      localTargetY - headLen * Math.sin(headAngle + 0.45),
    );
    g.closePath();
    g.fill({ color: vectorColor, alpha: arrowAlpha });

    // Touchdown Landing Bracket at the ground surface
    const bracketW = 28;
    g.moveTo(localTargetX - bracketW, localTargetY);
    g.lineTo(localTargetX + bracketW, localTargetY);
    g.stroke({ color: vectorColor, width: 2, alpha: 0.9 });

    g.moveTo(localTargetX - bracketW, localTargetY - 6);
    g.lineTo(localTargetX - bracketW, localTargetY);
    g.stroke({ color: vectorColor, width: 2, alpha: 0.9 });

    g.moveTo(localTargetX + bracketW, localTargetY - 6);
    g.lineTo(localTargetX + bracketW, localTargetY);
    g.stroke({ color: vectorColor, width: 2, alpha: 0.9 });

    // Center target indicator
    g.circle(localTargetX, localTargetY, 2.5);
    g.fill({ color: vectorColor, alpha: 0.9 });

    // Distance Badge pill along the arrow
    const badgeDist = Math.min(80, Math.max(originOffset + 24, totalDist * 0.45));
    const badgeX = ux * badgeDist;
    const badgeY = uy * badgeDist;

    const bw = 84;
    const bh = 30;
    bg.roundRect(badgeX - bw / 2, badgeY - bh / 2, bw, bh, 6);
    bg.fill({ color: 0x070d18, alpha: 0.88 });
    bg.stroke({ color: vectorColor, width: 1.5, alpha: arrowAlpha });

    // Update badge text
    this.distanceText.text = `▼ ${distanceMeters}m`;
    this.distanceText.style.fill = vectorColor;
    this.distanceText.x = badgeX;
    this.distanceText.y = badgeY - 5;

    const statusLabel = isCritical ? "CRITICAL" : isCaution ? "CAUTION" : "SAFE";
    this.statusText.text = `↓ ${downVelMs.toFixed(1)}m/s • ${statusLabel}`;
    this.statusText.style.fill = vectorColor;
    this.statusText.x = badgeX;
    this.statusText.y = badgeY + 7;
  }

  private drawVelocityVector(state: LanderBodyState, impactTolerance: number): void {
    const g = this.velocityVector;
    g.clear();

    const vel = state.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    if (speed < 0.4) return;

    // Short velocity vector inside the reticle ring
    const vectorLength = Math.min(speed * 3.5, 45);
    const angle = Math.atan2(vel.y, vel.x);
    const endX = Math.cos(angle) * vectorLength;
    const endY = Math.sin(angle) * vectorLength;

    const downVelMs = Math.max(0, vel.y) * 0.05;
    const dangerRatio = downVelMs / impactTolerance;
    const vectorColor = dangerRatio < 0.65 ? 0x39ff6b : dangerRatio < 1.0 ? 0xffd700 : 0xff2d2d;

    g.moveTo(0, 0);
    g.lineTo(endX, endY);
    g.stroke({ color: vectorColor, width: 2.5, alpha: 0.9 });

    // Arrowhead
    g.circle(endX, endY, 3);
    g.fill({ color: vectorColor });
  }

  private drawAltitudeTapeAndText(
    state: LanderBodyState,
    surfaceY: number,
    heightmap: number[] | undefined,
    sampleStep: number | undefined,
    impactTolerance: number,
  ): void {
    const g = this.altitudeTape;
    g.clear();

    const landerX = state.body.position.x;
    const landerY = state.body.position.y;
    const directGroundY = getTerrainHeightAtX(heightmap, sampleStep, landerX, surfaceY);
    const altPixels = Math.max(0, directGroundY - landerY);
    const altMeters = Math.round(altPixels / 2); // 1px = 0.5m

    const downVelMs = Math.max(0, state.body.velocity.y) * 0.05;
    const isSafe = downVelMs <= impactTolerance;

    // Right-side vertical altitude tape
    const tapeX = RETICLE_RADIUS + 14;
    const tapeH = 80;
    const tapeTopY = -tapeH / 2;
    const tapeBottomY = tapeH / 2;

    // Altitude text beneath the altitude tape
    this.altText.text = `${altMeters}m`;
    this.altText.style.fill = altMeters < 30 ? (isSafe ? 0x39ff6b : 0xff2d2d) : 0x8b9ab5;
    this.altText.x = tapeX + 3;
    this.altText.y = tapeBottomY + 4;

    // Tape track
    g.rect(tapeX, tapeTopY, 6, tapeH);
    g.fill({ color: 0x0c1726, alpha: 0.7 });
    g.stroke({ color: 0x1e2f47, width: 1 });

    // Height fill (reference 200m max tape scale)
    const maxRefAltMeters = 200;
    const fillFraction = Math.min(1, Math.max(0, altMeters / maxRefAltMeters));
    const fillHeight = tapeH * fillFraction;
    const tapeFillY = tapeBottomY - fillHeight;

    const tapeColor = altMeters < 30 ? (isSafe ? 0x39ff6b : 0xff2d2d) : 0x00d4ff;

    g.rect(tapeX, tapeFillY, 6, fillHeight);
    g.fill({ color: tapeColor, alpha: 0.85 });

    // Altitude tick marks
    const ticks = [0, 0.25, 0.5, 0.75, 1.0];
    for (const tick of ticks) {
      const ty = tapeBottomY - tapeH * tick;
      g.moveTo(tapeX + 6, ty);
      g.lineTo(tapeX + 10, ty);
      g.stroke({ color: 0x475569, width: 1 });
    }

    // Indicator cursor arrow pointing to current tape level
    g.moveTo(tapeX - 4, tapeFillY);
    g.lineTo(tapeX, tapeFillY - 3);
    g.lineTo(tapeX, tapeFillY + 3);
    g.closePath();
    g.fill({ color: tapeColor });
  }
}
