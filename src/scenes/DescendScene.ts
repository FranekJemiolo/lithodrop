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
  private surfaceY = 0;

  // Active module type (eventually set by drop selection; defaults to titanium_foundation for tutorial)
  private readonly activeModule: ModuleType = "titanium_foundation";
  private readonly activePlanetId = "luna_prime";

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
    const { bodies: terrainBodies, heightmap, sampleStep } = createTerrainBodies({
      width,
      surfaceY: this.surfaceY,
      seed: planet.terrainSeed,
      roughness: planet.terrainRoughness,
      hasCanyonWalls: planet.hasCanyonWalls,
    });
    this.drawTerrain(heightmap, sampleStep, width, height, planet.terrainColor);
    this.container.addChild(this.terrainGraphics);

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

    // ── Descend Phase System ─────────────────────────────────────────────────
    this.descendSystem = new DescendPhaseSystem(
      this.physicsWorld,
      this.inputSystem,
      landerState,
      this.activePlanetId,
    );

    // ── PixiJS Entities ──────────────────────────────────────────────────────
    this.landerEntity = new LanderEntity(this.activeModule);
    this.telemetryReticle = new TelemetryReticle();
    this.container.addChild(this.landerEntity.container);
    this.container.addChild(this.telemetryReticle.container);

    // ── HUD Labels ───────────────────────────────────────────────────────────
    this.buildControlsLabel(width, height);

    // ── Subscribe to touchdown event ─────────────────────────────────────────
    const unsubTouchdown = eventBus.on("PAYLOAD_TOUCHDOWN", (ev) => {
      unsubTouchdown();
      setTimeout(() => {
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

    // Sync visuals with physics
    this.landerEntity.syncFromPhysics(state, inputState.thrust, ticker.deltaMS);

    // Update telemetry reticle
    const profile = PAYLOAD_PROFILES[this.activeModule];
    this.telemetryReticle.update(state, profile?.impactTolerance ?? 5, this.surfaceY);
  };

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
