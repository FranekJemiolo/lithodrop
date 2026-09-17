/**
 * BuildScene — Colony base-building strategy phase (Milestone 3).
 *
 * Renders the orthographic base grid view:
 *   - Placed module sprites (programmatic PixiJS graphics)
 *   - Grid overlay lines
 *   - Dependency graph power-flow visualisation (glowing connections)
 *   - "Next Drop" button to transition back to descent
 *
 * BuildPhaseSystem manages all game state; this scene only renders it.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";
import { BuildPhaseSystem } from "../engine/systems/BuildPhaseSystem";
import { eventBus } from "../engine/events/EventBus";
import { getPlanetById } from "../constants/planets";
import { getModuleDef } from "../engine/grid/ModuleRegistry";
import type { ModuleInstance } from "../engine/grid/types";
import { audioManager } from "../engine/audio/AudioManager";

// Grid cell size in pixels
const CELL_PX = 72;

export class BuildScene {
  readonly container: Container;
  private readonly gameApp: GameApp;

  private buildSystem!: BuildPhaseSystem;
  private gridGraphics!: Graphics;
  private modulesContainer!: Container;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  private readonly unsubVictory: () => void;
  private readonly unsubModuleSnapped: () => void;

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();

    // Pre-subscribe (before start(), so we don't miss events)
    this.unsubVictory = eventBus.on("VICTORY", () => {
      void this.gameApp.transitionTo("victory");
    });

    this.unsubModuleSnapped = eventBus.on("MODULE_SNAPPED", () => {
      this.renderGrid();
      audioManager.playModuleSnap();
    });
  }

  start(): void {
    const { width, height } = this.gameApp.app.screen;

    audioManager.startBuildAmbient();

    this.gridOffsetX = width / 2;
    this.gridOffsetY = height * 0.45;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill(0x070b14);
    this.container.addChild(bg);

    // Planet atmosphere gradient strip at top
    this.drawAtmosphereStrip(width);

    // Grid graphics (background lines + module sprites)
    this.gridGraphics = new Graphics();
    this.modulesContainer = new Container();
    this.container.addChild(this.gridGraphics);
    this.container.addChild(this.modulesContainer);

    // Build system
    const planet = getPlanetById("luna_prime");
    this.buildSystem = new BuildPhaseSystem(planet);

    // HUD elements
    this.buildCorporateTicker(width);
    this.buildPhaseLabel(width);
    this.buildNextDropButton(width, height);

    // Initial grid render
    this.renderGrid();

    // Game loop
    this.gameApp.app.ticker.add(this.onTick);

    // Listen for economy ticks to update the ticker display
    eventBus.on("ECONOMY_TICK", (ev) => {
      this.updateTicker(ev.credits, ev.creditsPerSecond, ev.taxPerSecond, ev.netPerSecond);
    });

    console.log("LithoDrop: BuildScene started ✓");
  }

  private readonly onTick = (): void => {
    this.buildSystem.update(this.gameApp.app.ticker);
  };

  /** Render the grid: background lines + all placed modules */
  private renderGrid(): void {
    this.gridGraphics.clear();
    this.modulesContainer.removeChildren();

    const modules = this.buildSystem.grid.getAllModules();

    // Draw grid background lines (show a region around placed modules)
    this.drawGridLines(modules);

    // Draw placed modules
    for (const module of modules) {
      this.drawModule(module);
    }

    // Draw power connection lines between adjacent powered modules
    this.drawPowerConnections(modules);
  }

  private drawGridLines(modules: ModuleInstance[]): void {
    if (modules.length === 0) return;

    const g = this.gridGraphics;

    // Find extent
    let minQx = -3,
      maxQx = 3,
      minQy = -2,
      maxQy = 2;
    for (const m of modules) {
      minQx = Math.min(minQx, m.qx - 2);
      maxQx = Math.max(maxQx, m.qx + 2);
      minQy = Math.min(minQy, m.qy - 2);
      maxQy = Math.max(maxQy, m.qy + 2);
    }

    // Vertical grid lines
    for (let qx = minQx; qx <= maxQx + 1; qx++) {
      const x = this.gridOffsetX + qx * CELL_PX;
      const y1 = this.gridOffsetY + minQy * CELL_PX;
      const y2 = this.gridOffsetY + (maxQy + 1) * CELL_PX;
      g.moveTo(x, y1);
      g.lineTo(x, y2);
      g.stroke({ color: 0x1a2a3a, width: 1, alpha: 0.6 });
    }

    // Horizontal grid lines
    for (let qy = minQy; qy <= maxQy + 1; qy++) {
      const y = this.gridOffsetY + qy * CELL_PX;
      const x1 = this.gridOffsetX + minQx * CELL_PX;
      const x2 = this.gridOffsetX + (maxQx + 1) * CELL_PX;
      g.moveTo(x1, y);
      g.lineTo(x2, y);
      g.stroke({ color: 0x1a2a3a, width: 1, alpha: 0.6 });
    }
  }

  private drawModule(module: ModuleInstance): void {
    const def = getModuleDef(module.type);
    const node = this.buildSystem.graph.getNode(module.instanceId);
    const isPowered = node?.isPowered ?? false;

    const x = this.gridOffsetX + module.qx * CELL_PX;
    const y = this.gridOffsetY + module.qy * CELL_PX;

    const g = new Graphics();

    // Module background
    g.roundRect(x + 3, y + 3, CELL_PX - 6, CELL_PX - 6, 5);
    g.fill({ color: def.colorHex, alpha: isPowered ? 0.85 : 0.35 });
    g.stroke({ color: 0xffffff, width: 1, alpha: isPowered ? 0.4 : 0.15 });

    // Power status indicator (top-left dot)
    g.circle(x + 10, y + 10, 4);
    g.fill({ color: isPowered ? 0x39ff6b : 0xff2d2d });

    // Health bar (bottom of cell)
    const healthFraction = module.health / 100;
    const barWidth = (CELL_PX - 8) * healthFraction;
    g.rect(x + 4, y + CELL_PX - 8, CELL_PX - 8, 4);
    g.fill({ color: 0x1a2a3a });
    g.rect(x + 4, y + CELL_PX - 8, barWidth, 4);
    g.fill({
      color: healthFraction > 0.5 ? 0x39ff6b : healthFraction > 0.25 ? 0xffd700 : 0xff2d2d,
    });

    // Module type abbreviation label
    const label = new Text({
      text: def.displayName.substring(0, 3).toUpperCase(),
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 10,
        fontWeight: "500",
        fill: isPowered ? 0xffffff : 0x5a6a80,
      }),
    });
    label.x = x + 6;
    label.y = y + CELL_PX / 2 - 6;

    // Adjacency multiplier badge (if > 1.0)
    const multiplier = node?.adjacencyMultiplier ?? 1.0;
    if (multiplier > 1.01) {
      const badge = new Text({
        text: `×${multiplier.toFixed(1)}`,
        style: new TextStyle({
          fontFamily: "Outfit",
          fontSize: 9,
          fontWeight: "700",
          fill: 0xffd700,
        }),
      });
      badge.x = x + CELL_PX - 28;
      badge.y = y + 5;
      this.modulesContainer.addChild(badge);
    }

    this.modulesContainer.addChild(g);
    this.modulesContainer.addChild(label);
  }

  private drawPowerConnections(modules: ModuleInstance[]): void {
    const g = this.gridGraphics;

    // Draw a line between adjacent powered modules
    const drawnPairs = new Set<string>();

    for (const m of modules) {
      const node = this.buildSystem.graph.getNode(m.instanceId);
      if (!node?.isPowered) continue;

      const neighbors = this.buildSystem.grid.getOccupiedNeighbors({ qx: m.qx, qy: m.qy });
      for (const neighbor of neighbors) {
        const nNode = this.buildSystem.graph.getNode(neighbor.instanceId);
        if (!nNode?.isPowered) continue;

        const pairKey = [m.instanceId, neighbor.instanceId].sort().join("|");
        if (drawnPairs.has(pairKey)) continue;
        drawnPairs.add(pairKey);

        const x1 = this.gridOffsetX + m.qx * CELL_PX + CELL_PX / 2;
        const y1 = this.gridOffsetY + m.qy * CELL_PX + CELL_PX / 2;
        const x2 = this.gridOffsetX + neighbor.qx * CELL_PX + CELL_PX / 2;
        const y2 = this.gridOffsetY + neighbor.qy * CELL_PX + CELL_PX / 2;

        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke({ color: 0x00d4ff, width: 1.5, alpha: 0.25 });
      }
    }
  }

  private drawAtmosphereStrip(width: number): void {
    const g = new Graphics();
    // Subtle planet surface horizon effect
    g.rect(0, 0, width, 80);
    g.fill({ color: 0x0a1520, alpha: 0.6 });

    const label = new Text({
      text: "COLONY: LUNA PRIME — BASE CONSTRUCTION",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 13,
        fontWeight: "600",
        fill: 0x8b9ab5,
        letterSpacing: 4,
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.x = width / 2;
    label.y = 25;
    this.container.addChild(g);
    this.container.addChild(label);
  }

  // ─── HUD Elements ─────────────────────────────────────────────────────────

  private creditsText!: Text;
  private cpsText!: Text;
  private netText!: Text;

  private buildCorporateTicker(width: number): void {
    const panel = new Graphics();
    panel.roundRect(width - 260, 50, 250, 80, 8);
    panel.fill({ color: 0x0d1526, alpha: 0.85 });
    panel.stroke({ color: 0x1a2e4a, width: 1 });
    this.container.addChild(panel);

    const title = new Text({
      text: "MEGACORP TREASURY",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 10,
        fontWeight: "700",
        fill: 0x5a6a80,
        letterSpacing: 3,
      }),
    });
    title.x = width - 252;
    title.y = 58;
    this.container.addChild(title);

    this.creditsText = new Text({
      text: "CR  2,000",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 20,
        fontWeight: "500",
        fill: 0x00d4ff,
      }),
    });
    this.creditsText.x = width - 252;
    this.creditsText.y = 74;
    this.container.addChild(this.creditsText);

    this.cpsText = new Text({
      text: "+0 cr/s gross",
      style: new TextStyle({ fontFamily: "JetBrains Mono", fontSize: 11, fill: 0x39ff6b }),
    });
    this.cpsText.x = width - 252;
    this.cpsText.y = 102;
    this.container.addChild(this.cpsText);

    this.netText = new Text({
      text: "-2 cr/s net (tax tier 0)",
      style: new TextStyle({ fontFamily: "JetBrains Mono", fontSize: 10, fill: 0xff6b2b }),
    });
    this.netText.x = width - 252;
    this.netText.y = 118;
    this.container.addChild(this.netText);
  }

  private updateTicker(credits: number, cps: number, tax: number, net: number): void {
    this.creditsText.text = `CR  ${Math.floor(credits).toLocaleString()}`;
    this.cpsText.text = `+${cps.toFixed(1)} cr/s gross`;
    this.netText.text = `${net >= 0 ? "+" : ""}${net.toFixed(1)} cr/s net  (tax ${tax} cr/s)`;
    this.netText.style.fill = net >= 0 ? 0x39ff6b : 0xff2d2d;
  }

  private buildPhaseLabel(_width: number): void {
    const label = new Text({
      text: "⬡  BUILD PHASE",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 14,
        fontWeight: "700",
        fill: 0x39ff6b,
        letterSpacing: 3,
      }),
    });
    label.x = 16;
    label.y = 16;
    this.container.addChild(label);

    const hint = new Text({
      text: "Modules auto-placed after each successful landing",
      style: new TextStyle({ fontFamily: "Outfit", fontSize: 11, fill: 0x3a4a5a }),
    });
    hint.x = 16;
    hint.y = 40;
    this.container.addChild(hint);
  }

  private buildNextDropButton(width: number, height: number): void {
    const bw = 200,
      bh = 48;
    const bx = width / 2 - bw / 2;
    const by = height - 80;

    const btnBg = new Graphics();
    btnBg.roundRect(bx, by, bw, bh, 8);
    btnBg.fill({ color: 0xff6b2b });

    const btnText = new Text({
      text: "▼  NEXT DROP",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 15,
        fontWeight: "700",
        fill: 0x070b14,
        letterSpacing: 2,
      }),
    });
    btnText.anchor.set(0.5, 0.5);
    btnText.x = width / 2;
    btnText.y = by + bh / 2;

    const btn = new Container();
    btn.addChild(btnBg);
    btn.addChild(btnText);
    btn.eventMode = "static";
    btn.cursor = "pointer";

    btn.on("pointertap", () => {
      audioManager.playUIClick();
      void this.gameApp.transitionTo("descend");
    });

    btn.on("pointerover", () => {
      btnBg.clear();
      btnBg.roundRect(bx, by, bw, bh, 8);
      btnBg.fill({ color: 0xff8844 });
    });

    btn.on("pointerout", () => {
      btnBg.clear();
      btnBg.roundRect(bx, by, bw, bh, 8);
      btnBg.fill({ color: 0xff6b2b });
    });

    this.container.addChild(btn);
  }

  destroy(): void {
    audioManager.stopBuildAmbient();
    audioManager.stopAlarm();
    this.gameApp.app.ticker.remove(this.onTick);
    this.buildSystem?.destroy();
    this.unsubVictory();
    this.unsubModuleSnapped();
  }
}
