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
  private touchdownTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private unsubTouchdown: (() => void) | null = null;

  // Kinetic Juice: Procedural Camera Shake & Horizontal Dust Clouds
  private cameraShakeTrauma = 0;
  private dustGraphics!: Graphics;
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
      startY: height * 0.1,
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

    // Audio SFX updates
    if (inputState.thrust > 0 && state.fuelKg > 0) {
      audioManager.playThruster(inputState.thrust);
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
    this.telemetryReticle.update(state, profile?.impactTolerance ?? 5, this.surfaceY);

    // ── Kinetic Juice Updates ──────────────────────────────────────────────
    this.updateDust(ticker.deltaMS);
    this.updateCameraShake(ticker.deltaMS);
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
    const label = new Text({
      text: "W / ↑ = Thrust   A / ← = Rotate CCW   D / → = Rotate CW",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 11,
        fontWeight: "400",
        fill: 0x3a4a5a,
      }),
    });
    label.anchor.set(0.5, 1);
    label.x = width / 2;
    label.y = height - 12;
    this.container.addChild(label);
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
