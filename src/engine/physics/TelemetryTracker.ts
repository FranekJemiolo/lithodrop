/**
 * TelemetryTracker — Real-time telemetry monitor for lander descent.
 *
 * Continuously measures:
 *   1. Instantaneous linear acceleration (converted to Earth Gs)
 *   2. Lander tilt deviation from upright (in degrees)
 *   3. Peak values sustained during descent
 *
 * Evaluates active VIP contracts and immediately triggers failure if
 * G-force or tilt limits are breached.
 */

import type Matter from "matter-js";
import { PIXELS_PER_METER } from "../../constants/physics";
import { eventBus } from "../events/EventBus";
import type { VIPContract } from "../progression/SpecialContracts";

export interface TelemetryData {
  currentGForce: number;
  peakGForce: number;
  currentTiltDeg: number;
  peakTiltDeg: number;
  velocityMs: number;
  isVipBreached: boolean;
  breachReason?: string;
}

const EARTH_GRAVITY_MS2 = 9.81;

export class TelemetryTracker {
  private prevVelocity: { x: number; y: number } | null = null;
  private currentGForce = 0;
  private peakGForce = 0;
  private currentTiltDeg = 0;
  private peakTiltDeg = 0;
  private isVipBreached = false;
  private breachReason?: string;

  /**
   * Reset tracker between descent runs.
   */
  reset(): void {
    this.prevVelocity = null;
    this.currentGForce = 0;
    this.peakGForce = 0;
    this.currentTiltDeg = 0;
    this.peakTiltDeg = 0;
    this.isVipBreached = false;
    this.breachReason = undefined;
  }

  /**
   * Update telemetry readings from the lander's physics body.
   *
   * @param body - The lander Matter.js body
   * @param dtSeconds - Frame delta time in seconds
   * @param activeVipContract - Optional active VIP contract with limits
   */
  update(
    body: Matter.Body,
    dtSeconds: number,
    activeVipContract?: VIPContract | null,
  ): TelemetryData {
    const curVx = body.velocity.x;
    const curVy = body.velocity.y;

    // 1. Calculate linear acceleration and G-force
    if (this.prevVelocity && dtSeconds > 0) {
      const dvx = curVx - this.prevVelocity.x;
      const dvy = curVy - this.prevVelocity.y;
      const accelPxS2 = Math.sqrt(dvx * dvx + dvy * dvy) / dtSeconds;
      const accelMs2 = accelPxS2 / PIXELS_PER_METER;
      this.currentGForce = accelMs2 / EARTH_GRAVITY_MS2;
    } else {
      this.currentGForce = 0;
    }

    this.prevVelocity = { x: curVx, y: curVy };
    if (this.currentGForce > this.peakGForce) {
      this.peakGForce = this.currentGForce;
    }

    // 2. Calculate tilt angle from upright (0 radians = vertical)
    // Wrap to [-PI, PI] range
    let normAngle = body.angle % (2 * Math.PI);
    if (normAngle > Math.PI) normAngle -= 2 * Math.PI;
    if (normAngle < -Math.PI) normAngle += 2 * Math.PI;

    this.currentTiltDeg = Math.abs(normAngle) * (180 / Math.PI);
    if (this.currentTiltDeg > this.peakTiltDeg) {
      this.peakTiltDeg = this.currentTiltDeg;
    }

    // Current downward velocity approximation in m/s
    const velocityMs = Math.sqrt(curVx * curVx + curVy * curVy) / PIXELS_PER_METER;

    // 3. Check active VIP contract limits
    if (activeVipContract && !activeVipContract.isFailed && !activeVipContract.isCompleted) {
      if (this.currentGForce > activeVipContract.maxGForce) {
        this.isVipBreached = true;
        this.breachReason = `G-force limit exceeded: ${this.currentGForce.toFixed(2)}G > ${activeVipContract.maxGForce.toFixed(1)}G`;
        activeVipContract.isFailed = true;
        activeVipContract.failureReason = this.breachReason;

        eventBus.emit("VIP_CONTRACT_FAILED", {
          contractId: activeVipContract.id,
          reason: this.breachReason,
          gForce: this.currentGForce,
          tiltDeg: this.currentTiltDeg,
        });
      } else if (this.currentTiltDeg > activeVipContract.maxTiltDeg) {
        this.isVipBreached = true;
        this.breachReason = `Tilt limit exceeded: ${this.currentTiltDeg.toFixed(1)}° > ${activeVipContract.maxTiltDeg.toFixed(1)}°`;
        activeVipContract.isFailed = true;
        activeVipContract.failureReason = this.breachReason;

        eventBus.emit("VIP_CONTRACT_FAILED", {
          contractId: activeVipContract.id,
          reason: this.breachReason,
          gForce: this.currentGForce,
          tiltDeg: this.currentTiltDeg,
        });
      }
    }

    return this.getData(velocityMs);
  }

  /** Get snapshot of current telemetry data */
  getData(velocityMs = 0): TelemetryData {
    return {
      currentGForce: this.currentGForce,
      peakGForce: this.peakGForce,
      currentTiltDeg: this.currentTiltDeg,
      peakTiltDeg: this.peakTiltDeg,
      velocityMs,
      isVipBreached: this.isVipBreached,
      breachReason: this.breachReason,
    };
  }
}
