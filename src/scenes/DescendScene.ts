/**
 * DescendScene — Full lander physics descent scene (Milestone 2).
 *
 * Composes:
 *   - PhysicsWorld (Matter.js 50Hz fixed tick)
 *   - LanderBody (compound rigid body)
 *   - TerrainBody (static procedural terrain)
 *   - LanderEntity (PixiJS visual)
 *   - TelemetryReticle (PixiJS HUD)
 *   - InputSystem (keyboard + touch)
 *   - DescendPhaseSystem (game logic orchestrator)
 *
 * On PAYLOAD_TOUCHDOWN event, transitions to BuildScene.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";
import { PhysicsWorld } from "../engine/physics/PhysicsWorld";
import { createLanderBody } from "../engine/physics/LanderBody";
import { createTerrainBodies } from "../engine/physics/TerrainBody";
import { LanderEntity } from "../engine/entities/Lander";
import { TelemetryReticle } from "../engine/entities/TelemetryReticle";
import { InputSystem } from "../engine/systems/InputSystem";
import { DescendPhaseSystem } from "../engine/systems/DescendPhaseSystem";
import { eventBus } from "../engine/events/EventBus";
import { getPlanetById } from "../constants/planets";
import { PAYLOAD_PROFILES } from "../constants/physics";
import type { ModuleType } from "../engine/grid/types";
import { getModuleDef } from "../engine/grid/ModuleRegistry";
import { audioManager } from "../engine/audio/AudioManager";
import { HapticManager } from "../engine/audio/HapticManager";
import { HazardSystem } from "../engine/physics/HazardSystem";
import { HazardRenderer } from "../engine/entities/HazardRenderer";

export class DescendScene {
  readonly container: Container;
  private readonly gameApp: GameApp;

  private physicsWorld!: PhysicsWorld;
  private landerEntity!: LanderEntity;
  private telemetryReticle!: TelemetryReticle;
  private inputSystem!: InputSystem;
  private descendSystem!: DescendPhaseSystem;
  private backgroundGraphics!: Graphics;
  private terrainGraphics!: Graphics;
  private hazardSystem!: HazardSystem;
  private hazardRenderer!: HazardRenderer;
  private surfaceY = 0;
  private heightmap: number[] = [];
  private sampleStep = 0;
  private touchdownTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private unsubTouchdown: (() => void) | null = null;

  // Kinetic Juice: Procedural Camera Shake & Horizontal Dust Clouds
  private cameraShakeTrauma = 0;
  private dustGraphics!: Graphics;
  private controlsGfx!: Graphics;
  private dustParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    maxRadius: number;
    alpha: number;
    lifeMs: number;
    maxLifeMs: number;
    color: number;
  }> = [];

  private get activeModule(): ModuleType {
    return this.gameApp.selectedModuleType || "titanium_foundation";
  }
  private get activePlanetId(): string {
    return this.gameApp.selectedPlanetId || "luna_prime";
  }

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();
  }

  start(): void {
    const { width, height } = this.gameApp.app.screen;
    const planet = getPlanetById(this.activePlanetId);

    this.surfaceY = height * 0.75;

    // ── Background ───────────────────────────────────────────────────────────
    this.backgroundGraphics = new Graphics();
    this.drawBackground(width, height, planet.skyColorDeep, planet.skyColorHorizon);
    this.container.addChild(this.backgroundGraphics);

    // ── Terrain ──────────────────────────────────────────────────────────────
    this.terrainGraphics = new Graphics();
    const {
      bodies: terrainBodies,
      heightmap,
      sampleStep,
    } = createTerrainBodies({
      width,
      surfaceY: this.surfaceY,
      seed: planet.terrainSeed,
      roughness: planet.terrainRoughness,
      hasCanyonWalls: planet.hasCanyonWalls,
    });
    this.heightmap = heightmap;
    this.sampleStep = sampleStep;
    this.drawTerrain(heightmap, sampleStep, width, height, planet.terrainColor);
    this.container.addChild(this.terrainGraphics);

    // ── Dust Particle Layer ──────────────────────────────────────────────────
    this.dustGraphics = new Graphics();
    this.container.addChild(this.dustGraphics);

    // ── Physics World ────────────────────────────────────────────────────────
    this.physicsWorld = new PhysicsWorld(planet.gravityMs2);
    for (const body of terrainBodies) {
      this.physicsWorld.addBody(body);
    }

    // ── Lander Body ──────────────────────────────────────────────────────────
    const landerState = createLanderBody({
      moduleType: this.activeModule,
      startX: width / 2,
      startY: Math.max(80, height * 0.2),
    });
    this.physicsWorld.addBody(landerState.body);

    // ── Input System ─────────────────────────────────────────────────────────
    this.inputSystem = new InputSystem(this.gameApp.app.canvas as HTMLCanvasElement);

    // ── Environmental Hazards ────────────────────────────────────────────────
    this.hazardSystem = new HazardSystem(this.activePlanetId, width, this.surfaceY);
    this.hazardRenderer = new HazardRenderer(this.hazardSystem.getHazards());
    this.container.addChild(this.hazardRenderer.container);

    // ── Descend Phase System ─────────────────────────────────────────────────
    this.descendSystem = new DescendPhaseSystem(
      this.physicsWorld,
      this.inputSystem,
      landerState,
      this.activePlanetId,
      this.hazardSystem,
      this.surfaceY,
    );

    // ── PixiJS Entities ──────────────────────────────────────────────────────
    this.landerEntity = new LanderEntity(this.activeModule);
    this.telemetryReticle = new TelemetryReticle();
    this.container.addChild(this.landerEntity.container);
    this.container.addChild(this.telemetryReticle.container);

    // ── HUD Labels ───────────────────────────────────────────────────────────
    this.buildControlsLabel(width, height);

    // ── Subscribe to touchdown event ─────────────────────────────────────────
    this.unsubTouchdown = eventBus.on("PAYLOAD_TOUCHDOWN", (ev) => {
      this.unsubTouchdown?.();
      this.unsubTouchdown = null;
      audioManager.stopThruster();

      const def = getModuleDef(ev.moduleType);
      const state = this.descendSystem.getLanderState();

      // Trigger visual impact squash & stretch deformation
      this.landerEntity.triggerImpactSquash(ev.velocity, def.mass);

      // Procedural Camera Shake scaled with mass and velocity
      this.cameraShakeTrauma = Math.min(
        1.0,
        Math.max(0.35, (ev.velocity / 12) * (def.mass / 8400)),
      );

      // Kick up horizontal dust clouds along the surface
      this.spawnTouchdownDust(
        state.body.position.x,
        this.surfaceY,
        ev.velocity,
        def.mass,
        planet.terrainColor,
      );

      // Mobile Haptic Feedback
      HapticManager.triggerTouchdown(ev.velocity, def.mass, ev.survived);

      if (ev.survived) {
        audioManager.playLandingSuccess();
      } else {
        audioManager.playImpact(ev.velocity, false);
      }
      this.touchdownTimeoutId = setTimeout(() => {
        void this.gameApp.transitionTo(ev.survived ? "build" : "title");
      }, 1500);
    });

    // ── Game Loop ────────────────────────────────────────────────────────────
    this.gameApp.app.ticker.add(this.onTick);

    console.log("LithoDrop: DescendScene started ✓");
  }

  private readonly onTick = (): void => {
    const ticker = this.gameApp.app.ticker;
    const state = this.descendSystem.getLanderState();
    const inputState = this.inputSystem.getState();

    // Update physics
    this.descendSystem.update(ticker);

    // Update environmental hazard visuals
    this.hazardRenderer.update(ticker.deltaMS);

    // Audio SFX & Haptics updates
    if (inputState.thrust > 0 && state.fuelKg > 0) {
      audioManager.playThruster(inputState.thrust);
      HapticManager.triggerThrusterPulse();
    } else {
      audioManager.stopThruster();
    }
    if (inputState.rotation !== 0) {
      audioManager.playRCS();
    }

    // Sync visuals with physics
    this.landerEntity.syncFromPhysics(state, inputState.thrust, ticker.deltaMS);

    // Update telemetry reticle
    const profile = PAYLOAD_PROFILES[this.activeModule];
    this.telemetryReticle.update(
      state,
      profile?.impactTolerance ?? 5,
      this.surfaceY,
      this.heightmap,
      this.sampleStep,
    );

    // ── Kinetic Juice Updates ──────────────────────────────────────────────
    this.updateDust(ticker.deltaMS);
    this.updateCameraShake(ticker.deltaMS);
    this.updateControlsGfx();
  };

  private spawnTouchdownDust(
    impactX: number,
    impactY: number,
    velocity: number,
    mass: number,
    terrainColor: number,
  ): void {
    const intensity = Math.min(2.2, Math.max(0.6, (velocity / 9) * (mass / 8400)));
    const count = Math.floor(28 * intensity);

    for (let i = 0; i < count; i++) {
      // Half blast left, half blast right
      const dir = i % 2 === 0 ? -1 : 1;
      const speed = (40 + Math.random() * 180) * intensity;
      const vx = dir * speed;
      const vy = -(6 + Math.random() * 24);
      const lifeMs = 500 + Math.random() * 450;

      this.dustParticles.push({
        x: impactX + (Math.random() - 0.5) * 24,
        y: impactY - 2,
        vx,
        vy,
        radius: 3 + Math.random() * 3,
        maxRadius: 10 + Math.random() * 16 * intensity,
        alpha: 0.8,
        lifeMs,
        maxLifeMs: lifeMs,
        color: terrainColor,
      });
    }
  }

  private updateDust(deltaMS: number): void {
    const g = this.dustGraphics;
    g.clear();
    if (this.dustParticles.length === 0) return;

    const dt = deltaMS / 1000;
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.lifeMs -= deltaMS;
      if (p.lifeMs <= 0) {
        this.dustParticles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94; // horizontal drag
      p.vy += 15 * dt; // slight settling

      const progress = 1.0 - p.lifeMs / p.maxLifeMs;
      const r = p.radius + (p.maxRadius - p.radius) * progress;
      const a = p.alpha * (1.0 - progress);

      g.circle(p.x, p.y, r);
      g.fill({ color: p.color, alpha: a });
    }
  }

  private updateCameraShake(deltaMS: number): void {
    if (this.cameraShakeTrauma <= 0) {
      this.container.x = 0;
      this.container.y = 0;
      this.container.rotation = 0;
      return;
    }

    this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - (deltaMS / 1000) * 1.8);
    const shake = this.cameraShakeTrauma * this.cameraShakeTrauma;

    this.container.x = (Math.random() - 0.5) * 36 * shake;
    this.container.y = (Math.random() - 0.5) * 36 * shake;
    this.container.rotation = (Math.random() - 0.5) * 0.04 * shake;
  }

  private drawBackground(
    width: number,
    height: number,
    skyDeep: number,
    _skyHorizon: number,
  ): void {
    const g = this.backgroundGraphics;
    g.rect(0, 0, width, height);
    g.fill(skyDeep);

    // Simple star field for luna prime
    const rng = mulberry32(12345);
    for (let i = 0; i < 200; i++) {
      const x = rng() * width;
      const y = rng() * height * 0.7;
      const r = rng() * 1.2 + 0.2;
      const a = rng() * 0.5 + 0.2;
      g.circle(x, y, r);
      g.fill({ color: 0xffffff, alpha: a });
    }
  }

  private drawTerrain(
    heightmap: number[],
    sampleStep: number,
    width: number,
    height: number,
    terrainColor: number,
  ): void {
    const g = this.terrainGraphics;

    // Draw terrain surface as a filled polygon
    g.moveTo(0, height);
    for (let i = 0; i < heightmap.length; i++) {
      g.lineTo(i * sampleStep, heightmap[i]);
    }
    g.lineTo(width, height);
    g.closePath();
    g.fill({ color: terrainColor });

    // Terrain surface line highlight
    g.moveTo(0, heightmap[0]);
    for (let i = 1; i < heightmap.length; i++) {
      g.lineTo(i * sampleStep, heightmap[i]);
    }
    g.stroke({ color: 0x8b9ab5, width: 2, alpha: 0.4 });
  }

  private buildControlsLabel(width: number, height: number): void {
    // 1. Controls legend at bottom center
    const label = new Text({
      text: "W / ↑: Full Thrust | S / ↓: Hover Brake | A / D: Steer | SAS Gyros Active",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 11,
        fontWeight: "400",
        fill: 0x4a6078,
      }),
    });
    label.anchor.set(0.5, 1);
    label.x = width / 2;
    label.y = height - 8;
    this.container.addChild(label);

    // 2. Interactive control HUD overlay for mobile and desktop feedback
    this.controlsGfx = new Graphics();
    this.container.addChild(this.controlsGfx);

    // Interactive button hit areas for direct mouse/touch engagement
    const btnSteerLeft = new Container();
    btnSteerLeft.eventMode = "static";
    btnSteerLeft.cursor = "pointer";
    btnSteerLeft.hitArea = {
      contains: (x, y) => x >= 16 && x <= 92 && y >= height - 68 && y <= height - 28,
    };
    btnSteerLeft.on("pointerdown", () => this.inputSystem.setVirtualRotation(-1));
    btnSteerLeft.on("pointerup", () => this.inputSystem.setVirtualRotation(0));
    btnSteerLeft.on("pointerupoutside", () => this.inputSystem.setVirtualRotation(0));
    this.container.addChild(btnSteerLeft);

    const btnSteerRight = new Container();
    btnSteerRight.eventMode = "static";
    btnSteerRight.cursor = "pointer";
    btnSteerRight.hitArea = {
      contains: (x, y) => x >= 96 && x <= 172 && y >= height - 68 && y <= height - 28,
    };
    btnSteerRight.on("pointerdown", () => this.inputSystem.setVirtualRotation(1));
    btnSteerRight.on("pointerup", () => this.inputSystem.setVirtualRotation(0));
    btnSteerRight.on("pointerupoutside", () => this.inputSystem.setVirtualRotation(0));
    this.container.addChild(btnSteerRight);

    const btnThrust = new Container();
    btnThrust.eventMode = "static";
    btnThrust.cursor = "pointer";
    btnThrust.hitArea = {
      contains: (x, y) =>
        x >= width - 112 && x <= width - 18 && y >= height - 92 && y <= height - 56,
    };
    btnThrust.on("pointerdown", () => {
      this.inputSystem.setVirtualThrust(1.0);
      HapticManager.triggerThrusterPulse();
    });
    btnThrust.on("pointerup", () => this.inputSystem.setVirtualThrust(0));
    btnThrust.on("pointerupoutside", () => this.inputSystem.setVirtualThrust(0));
    this.container.addChild(btnThrust);

    const btnHover = new Container();
    btnHover.eventMode = "static";
    btnHover.cursor = "pointer";
    btnHover.hitArea = {
      contains: (x, y) =>
        x >= width - 112 && x <= width - 18 && y >= height - 50 && y <= height - 14,
    };
    btnHover.on("pointerdown", () => {
      this.inputSystem.setVirtualThrust(0.45);
      HapticManager.triggerThrusterPulse();
    });
    btnHover.on("pointerup", () => this.inputSystem.setVirtualThrust(0));
    btnHover.on("pointerupoutside", () => this.inputSystem.setVirtualThrust(0));
    this.container.addChild(btnHover);

    // Steer Left Label
    const steerLeftText = new Text({
      text: "◄ STEER",
      style: new TextStyle({
        fontFamily: "Outfit, sans-serif",
        fontSize: 12,
        fontWeight: "700",
        fill: 0x8bb8e8,
      }),
    });
    steerLeftText.anchor.set(0.5, 0.5);
    steerLeftText.x = 54;
    steerLeftText.y = height - 48;
    this.container.addChild(steerLeftText);

    // Steer Right Label
    const steerRightText = new Text({
      text: "STEER ►",
      style: new TextStyle({
        fontFamily: "Outfit, sans-serif",
        fontSize: 12,
        fontWeight: "700",
        fill: 0x8bb8e8,
      }),
    });
    steerRightText.anchor.set(0.5, 0.5);
    steerRightText.x = 134;
    steerRightText.y = height - 48;
    this.container.addChild(steerRightText);

    // Main Thruster Label
    const thrustText = new Text({
      text: "▲ THRUST",
      style: new TextStyle({
        fontFamily: "Outfit, sans-serif",
        fontSize: 12,
        fontWeight: "800",
        fill: 0x00e5ff,
      }),
    });
    thrustText.anchor.set(0.5, 0.5);
    thrustText.x = width - 65;
    thrustText.y = height - 74;
    this.container.addChild(thrustText);

    // Hover Throttle Label
    const hoverText = new Text({
      text: "▼ HOVER",
      style: new TextStyle({
        fontFamily: "Outfit, sans-serif",
        fontSize: 11,
        fontWeight: "700",
        fill: 0xffaa00,
      }),
    });
    hoverText.anchor.set(0.5, 0.5);
    hoverText.x = width - 65;
    hoverText.y = height - 32;
    this.container.addChild(hoverText);

    // SAS Status Indicator
    const sasText = new Text({
      text: "● SAS: GYRO AUTO-LEVEL",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 10,
        fontWeight: "600",
        fill: 0x38bdf8,
      }),
    });
    sasText.anchor.set(0.5, 0);
    sasText.x = width / 2;
    sasText.y = 12;
    this.container.addChild(sasText);
  }

  private updateControlsGfx(): void {
    if (!this.controlsGfx) return;
    const { width, height } = this.gameApp.app.screen;
    const states = this.inputSystem.getControlActiveStates();
    const g = this.controlsGfx;
    g.clear();

    // Steer Left button box
    g.roundRect(16, height - 68, 76, 40, 6);
    g.fill({ color: states.rotLeft ? 0x00e5ff : 0x07111e, alpha: states.rotLeft ? 0.35 : 0.22 });
    g.stroke({
      color: states.rotLeft ? 0x00e5ff : 0x224466,
      width: states.rotLeft ? 2 : 1,
      alpha: states.rotLeft ? 0.9 : 0.45,
    });

    // Steer Right button box
    g.roundRect(96, height - 68, 76, 40, 6);
    g.fill({ color: states.rotRight ? 0x00e5ff : 0x07111e, alpha: states.rotRight ? 0.35 : 0.22 });
    g.stroke({
      color: states.rotRight ? 0x00e5ff : 0x224466,
      width: states.rotRight ? 2 : 1,
      alpha: states.rotRight ? 0.9 : 0.45,
    });

    // Main Thruster button box
    g.roundRect(width - 112, height - 92, 94, 36, 6);
    g.fill({ color: states.thrust ? 0x00e5ff : 0x07111e, alpha: states.thrust ? 0.4 : 0.22 });
    g.stroke({
      color: states.thrust ? 0x00e5ff : 0x224466,
      width: states.thrust ? 2 : 1,
      alpha: states.thrust ? 0.9 : 0.45,
    });

    // Hover button box
    g.roundRect(width - 112, height - 50, 94, 36, 6);
    g.fill({ color: states.hover ? 0xffaa00 : 0x07111e, alpha: states.hover ? 0.4 : 0.22 });
    g.stroke({
      color: states.hover ? 0xffaa00 : 0x443322,
      width: states.hover ? 2 : 1,
      alpha: states.hover ? 0.9 : 0.45,
    });
  }

  destroy(): void {
    if (this.touchdownTimeoutId) {
      clearTimeout(this.touchdownTimeoutId);
      this.touchdownTimeoutId = null;
    }
    if (this.unsubTouchdown) {
      this.unsubTouchdown();
      this.unsubTouchdown = null;
    }
    audioManager.stopThruster();
    this.hazardRenderer?.destroy();
    this.gameApp.app.ticker.remove(this.onTick);
    this.descendSystem?.destroy();
    this.physicsWorld?.destroy();
    this.inputSystem?.destroy();
  }
}

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
