/**
 * GameApp — PixiJS Application singleton and game loop orchestrator.
 *
 * Responsibilities:
 *   - Create and manage the PixiJS Application (WebGL renderer)
 *   - Attach the canvas to the DOM
 *   - Manage scene transitions (Title → Tutorial → Descend → Build)
 *   - Drive the fixed-rate physics tick alongside the render loop
 *   - Handle resize events and device pixel ratio changes
 *
 * The GameApp is instantiated once in main.tsx and passed to HudRoot
 * so the React layer can read phase state via the EventBus.
 */

import { Application, Container } from "pixi.js";
import { eventBus } from "./events/EventBus";
import type { GamePhase } from "./events/EventTypes";

export class GameApp {
  readonly app: Application;
  private currentPhase: GamePhase = "title";
  private sceneContainer: Container;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.app = new Application();
    this.sceneContainer = new Container();
  }

  async init(): Promise<void> {
    const container = document.getElementById("game-canvas-container");
    if (!container) {
      throw new Error("GameApp: #game-canvas-container not found.");
    }

    // Initialize PixiJS with optimal settings for game performance
    await this.app.init({
      // Use canvas element inside the container div
      canvas: undefined,
      resizeTo: container,
      backgroundColor: 0x070b14, // --color-void
      antialias: false, // Disabled for crisp pixel edges on sprites
      resolution: Math.min(window.devicePixelRatio, 2), // Cap at 2x for performance
      autoDensity: true,
      powerPreference: "high-performance",
    });

    // Inject canvas into container
    container.appendChild(this.app.canvas);

    // Root scene container: all game scenes are children of this
    this.app.stage.addChild(this.sceneContainer);

    // Handle window resize
    this.setupResizeObserver(container);

    // Transition to title screen
    await this.transitionTo("title");

    console.log("LithoDrop: GameApp initialized ✓");
  }

  private _selectedPlanetId = "luna_prime";

  get selectedPlanetId(): string {
    return this._selectedPlanetId;
  }

  set selectedPlanetId(id: string) {
    this._selectedPlanetId = id;
  }

  /** Current game phase — read-only from outside */
  get phase(): GamePhase {
    return this.currentPhase;
  }

  /**
   * Transition to a new game phase.
   * Tears down the current scene, emits PHASE_CHANGED event, and
   * boots the new scene.
   */
  async transitionTo(newPhase: GamePhase): Promise<void> {
    const previousPhase = this.currentPhase;

    // Clear current scene
    this.sceneContainer.removeChildren();

    this.currentPhase = newPhase;

    // Lazy-load scene to keep initial bundle small
    await this.loadScene(newPhase);

    eventBus.emit("PHASE_CHANGED", { from: previousPhase, to: newPhase });

    console.log(`LithoDrop: Phase ${previousPhase} → ${newPhase}`);
  }

  private async loadScene(phase: GamePhase): Promise<void> {
    switch (phase) {
      case "title": {
        const { TitleScene } = await import("../scenes/TitleScene");
        const scene = new TitleScene(this);
        this.sceneContainer.addChild(scene.container);
        scene.start();
        break;
      }
      case "tutorial": {
        const { TutorialScene } = await import("../scenes/TutorialScene");
        const scene = new TutorialScene(this);
        this.sceneContainer.addChild(scene.container);
        scene.start();
        break;
      }
      case "campaign": {
        const { CampaignScene } = await import("../scenes/CampaignScene");
        const scene = new CampaignScene(this);
        this.sceneContainer.addChild(scene.container);
        scene.start();
        break;
      }
      case "descend": {
        const { DescendScene } = await import("../scenes/DescendScene");
        const scene = new DescendScene(this);
        this.sceneContainer.addChild(scene.container);
        scene.start();
        break;
      }
      case "build": {
        const { BuildScene } = await import("../scenes/BuildScene");
        const scene = new BuildScene(this);
        this.sceneContainer.addChild(scene.container);
        scene.start();
        break;
      }
      case "gameover":
      case "victory":
        // These phases are handled purely by React HUD overlays
        break;
    }
  }

  private setupResizeObserver(container: HTMLElement): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.app.resize();
    });
    this.resizeObserver.observe(container);
  }

  /** Clean up all resources (used in tests and app teardown) */
  destroy(): void {
    this.resizeObserver?.disconnect();
    eventBus.clearAll();
    this.app.destroy(true, { children: true, texture: true });
  }
}
