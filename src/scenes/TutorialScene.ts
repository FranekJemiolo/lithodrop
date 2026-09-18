/**
 * TutorialScene — Dropmaster Certification VR Onboarding.
 *
 * Implements a 4-stage VR flight simulator isolating core mechanics:
 *   Stage 1: BASIC THRUST (Thrust vector, RCS torque, attitude gyro)
 *   Stage 2: IMPACT THRESHOLDS (Touchdown speed limits, structural tolerances)
 *   Stage 3: MAGNETIC SNAPPING (Base grid placement, cantilever torque limits)
 *   Stage 4: COLONY ECONOMY (Power conduits, Hydroponics ↔ Habitation synergies, corporate tax)
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";
import { audioManager } from "../engine/audio/AudioManager";

interface TutorialStage {
  id: string;
  stageNumber: string;
  title: string;
  subtitle: string;
  badge: string;
  color: number;
  description: string[];
  tips: string;
  interactiveType: "thrust" | "impact" | "snapping" | "economy";
}

const STAGES: TutorialStage[] = [
  {
    id: "thrust",
    stageNumber: "01",
    title: "VECTOR FLIGHT & THRUST",
    subtitle: "RCS ATTITUDE & VELOCITY DAMPENING",
    badge: "FLIGHT CONTROL",
    color: 0x00d4ff,
    description: [
      "• MAIN ENGINE: Hold [W] / [Up Arrow] or Screen Touch to fire main descent thruster against planetary gravity.",
      "• ATTITUDE CONTROL: Tap [A] / [D] or Swipe Horizontally to fire counter-torque RCS attitude thrusters.",
      "• INERTIA: Atmospheric drag varies per planetary biome. Keep your flight vector aligned with the descent corridor.",
    ],
    tips: "TIP: Pulsing the thruster consumes less fuel than sustained continuous burns.",
    interactiveType: "thrust",
  },
  {
    id: "impact",
    stageNumber: "02",
    title: "IMPACT VELOCITY THRESHOLDS",
    subtitle: "STRUCTURAL DAMAGE & SHATTER RISK",
    badge: "TOUCHDOWN SAFETY",
    color: 0x39ff6b,
    description: [
      "• TOUCHDOWN ENVELOPE: Each module type has an engineering impact tolerance (m/s).",
      "• FRAGILE PAYLOADS: Hydroponics Domes shatter at > 2.5 m/s. Titanium Foundations withstand up to 12.0 m/s.",
      "• DROP BOUNTY: Touchdowns executed with remaining fuel and minimal impact speed receive corporate bounty multipliers up to 3.9×!",
    ],
    tips: "CRITICAL: Speeds exceeding tolerance inflict instantaneous hull damage or catastrophic cratering.",
    interactiveType: "impact",
  },
  {
    id: "snapping",
    stageNumber: "03",
    title: "MAGNETIC GRID & CANTILEVERS",
    subtitle: "BASE EXPANSION & TORQUE INTEGRITY",
    badge: "STRUCTURAL ENGINEERING",
    color: 0xffd700,
    description: [
      "• MAGNETIC SNAP: Surviving payloads automatically snap into adjacent valid grid slots on the colony perimeter.",
      "• BENDING TORQUE: Cantilevered structures (horizontal overhangs without vertical foundation support) incur bending moments.",
      "• OVERLOAD COLLAPSE: If cumulative torque exceeds joint limits (15,000 N·m per foundation), unsupported arms collapse!",
    ],
    tips: "RULE: Build vertical foundation pillars into bedrock before constructing wide horizontal decks.",
    interactiveType: "snapping",
  },
  {
    id: "economy",
    stageNumber: "04",
    title: "POWER CONDUITS & ADJACENCY",
    subtitle: "RESOURCE FLOW & CORPORATE QUOTA",
    badge: "MEGACORP SURVIVAL",
    color: 0xff6b2b,
    description: [
      "• POWER MESH: Modules require adjacent power routing from Solar Arrays (+40 pwr) or Fission Reactors (+200 pwr).",
      "• HABITATION SYNERGY: Placing a Hydroponics Dome next to a Crew Habitat provides a +25% bio-dome food multiplier!",
      "• TAX ESCALATION: Megacorp corporate tax escalates every 180 seconds. Maintain positive cash flow to prevent bankruptcy.",
    ],
    tips: "WIN CONDITION: Sustain your planetary revenue quota for 60 consecutive seconds to authorize the Anchor Project.",
    interactiveType: "economy",
  },
];

export class TutorialScene {
  readonly container: Container;
  private readonly gameApp: GameApp;
  private currentStageIndex = 0;

  private stageDisplayContainer: Container;
  private tabsContainer: Container;
  private interactiveGraphic: Graphics;
  private animTimer = 0;

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();
    this.stageDisplayContainer = new Container();
    this.tabsContainer = new Container();
    this.interactiveGraphic = new Graphics();
  }

  start(): void {
    const { width, height } = this.gameApp.app.screen;
    const cx = width / 2;

    audioManager.startBuildAmbient();

    // Deep space sci-fi background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill(0x050811);
    this.container.addChild(bg);

    // VR Grid hologram
    const grid = new Graphics();
    for (let x = 0; x < width; x += 40) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 40) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.stroke({ color: 0x00d4ff, alpha: 0.05, width: 1 });
    this.container.addChild(grid);

    // Top Header
    const header = new Text({
      text: "DROPMASTER CERTIFICATION VR // ORBITAL SIMULATOR",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: Math.min(width * 0.035, 24),
        fontWeight: "800",
        fill: 0x00d4ff,
        letterSpacing: 3,
      }),
    });
    header.anchor.set(0.5, 0);
    header.x = cx;
    header.y = Math.max(16, height * 0.03);
    this.container.addChild(header);

    const subheader = new Text({
      text: "OFF-WORLD COLONIAL EXPEDITION // PILOT TRAINING PROTOCOLS",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: Math.min(width * 0.018, 11),
        fill: 0x8b9ab5,
        letterSpacing: 2,
      }),
    });
    subheader.anchor.set(0.5, 0);
    subheader.x = cx;
    subheader.y = header.y + header.height + 4;
    this.container.addChild(subheader);

    // Tabs Container
    this.container.addChild(this.tabsContainer);

    // Main Stage Display Container
    this.container.addChild(this.stageDisplayContainer);
    this.stageDisplayContainer.addChild(this.interactiveGraphic);

    // Navigation & Action Buttons
    this.buildNavigationControls(width, height);

    // Render Initial Stage
    this.renderTabs(width, height);
    this.renderStage(width, height);

    // Animation ticker for interactive diagrams
    this.gameApp.app.ticker.add(this.onTick);

    console.log("LithoDrop: Dropmaster Certification VR loaded ✓");
  }

  private readonly onTick = (): void => {
    this.animTimer += 0.05;
    this.updateInteractiveGraphic();
  };

  private renderTabs(width: number, height: number): void {
    this.tabsContainer.removeChildren();
    const cx = width / 2;
    const tabY = Math.max(70, height * 0.12);

    const tabWidth = Math.min(170, (width - 40) / STAGES.length);
    const tabHeight = 36;
    const totalW = STAGES.length * tabWidth + (STAGES.length - 1) * 8;
    const startX = cx - totalW / 2;

    STAGES.forEach((stage, idx) => {
      const isSelected = idx === this.currentStageIndex;
      const tx = startX + idx * (tabWidth + 8);

      const tab = new Container();
      tab.eventMode = "static";
      tab.cursor = "pointer";

      const bg = new Graphics();
      bg.roundRect(tx, tabY, tabWidth, tabHeight, 6);
      bg.fill({ color: isSelected ? stage.color : 0x0e1726, alpha: isSelected ? 0.9 : 0.6 });
      bg.stroke({ color: stage.color, width: isSelected ? 2 : 1, alpha: isSelected ? 1.0 : 0.3 });

      const label = new Text({
        text: `${stage.stageNumber}  ${stage.badge}`,
        style: new TextStyle({
          fontFamily: "JetBrains Mono",
          fontSize: 10,
          fontWeight: isSelected ? "700" : "500",
          fill: isSelected ? 0x050811 : 0x94a3b8,
          letterSpacing: 1,
        }),
      });
      label.anchor.set(0.5, 0.5);
      label.x = tx + tabWidth / 2;
      label.y = tabY + tabHeight / 2;

      tab.addChild(bg);
      tab.addChild(label);

      tab.on("pointertap", () => {
        audioManager.playUIClick();
        this.currentStageIndex = idx;
        this.renderTabs(width, height);
        this.renderStage(width, height);
      });

      this.tabsContainer.addChild(tab);
    });
  }

  private renderStage(width: number, height: number): void {
    // Clear old text/cards except interactiveGraphic
    this.stageDisplayContainer.removeChildren();
    this.stageDisplayContainer.addChild(this.interactiveGraphic);

    const stage = STAGES[this.currentStageIndex];
    const cx = width / 2;
    const isWide = width >= 800;

    const cardY = Math.max(120, height * 0.19);
    const cardW = isWide ? width * 0.46 : width - 40;
    const cardH = Math.min(380, height * 0.58);
    const cardX = isWide ? width * 0.05 : cx - cardW / 2;

    // Briefing Card (Left on desktop)
    const cardBg = new Graphics();
    cardBg.roundRect(cardX, cardY, cardW, cardH, 12);
    cardBg.fill({ color: 0x0a1220, alpha: 0.9 });
    cardBg.stroke({ color: stage.color, alpha: 0.4, width: 1.5 });
    this.stageDisplayContainer.addChild(cardBg);

    // Stage Subtitle
    const sub = new Text({
      text: `STAGE ${stage.stageNumber} // ${stage.subtitle}`,
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 10,
        fontWeight: "700",
        fill: stage.color,
        letterSpacing: 2,
      }),
    });
    sub.x = cardX + 20;
    sub.y = cardY + 20;
    this.stageDisplayContainer.addChild(sub);

    // Stage Title
    const title = new Text({
      text: stage.title,
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: Math.min(cardW * 0.065, 22),
        fontWeight: "800",
        fill: 0xffffff,
        letterSpacing: 1.5,
      }),
    });
    title.x = cardX + 20;
    title.y = sub.y + 20;
    this.stageDisplayContainer.addChild(title);

    // Description Items
    let curY = title.y + 36;
    stage.description.forEach((line) => {
      const desc = new Text({
        text: line,
        style: new TextStyle({
          fontFamily: "Outfit",
          fontSize: 13,
          fontWeight: "400",
          fill: 0xc4d1e5,
          wordWrap: true,
          wordWrapWidth: cardW - 40,
          lineHeight: 20,
        }),
      });
      desc.x = cardX + 20;
      desc.y = curY;
      this.stageDisplayContainer.addChild(desc);
      curY += desc.height + 12;
    });

    // Pro Tip Box
    const tipBox = new Graphics();
    const tipH = 46;
    tipBox.roundRect(cardX + 20, cardY + cardH - tipH - 20, cardW - 40, tipH, 6);
    tipBox.fill({ color: 0x111c2e, alpha: 0.8 });
    tipBox.stroke({ color: stage.color, alpha: 0.3, width: 1 });
    this.stageDisplayContainer.addChild(tipBox);

    const tipText = new Text({
      text: stage.tips,
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 10.5,
        fill: stage.color,
        wordWrap: true,
        wordWrapWidth: cardW - 60,
      }),
    });
    tipText.x = cardX + 30;
    tipText.y = cardY + cardH - tipH - 12;
    this.stageDisplayContainer.addChild(tipText);

    // Interactive Simulation Graphic Setup (Right on desktop)
    const simW = isWide ? width * 0.42 : width - 40;
    const simH = cardH;
    const simX = isWide ? width * 0.53 : cx - simW / 2;
    const simY = isWide ? cardY : cardY + cardH + 15;

    // Simulation Frame
    const simBg = new Graphics();
    simBg.roundRect(simX, simY, simW, simH, 12);
    simBg.fill({ color: 0x070c16, alpha: 0.95 });
    simBg.stroke({ color: 0x1a2e4a, width: 1.5 });
    this.stageDisplayContainer.addChild(simBg);

    const simTitle = new Text({
      text: "VR TELEMETRY SIMULATOR",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 10,
        fontWeight: "700",
        fill: 0x5a6a80,
        letterSpacing: 2,
      }),
    });
    simTitle.x = simX + 20;
    simTitle.y = simY + 16;
    this.stageDisplayContainer.addChild(simTitle);

    this.updateInteractiveGraphic();
  }

  private updateInteractiveGraphic(): void {
    const { width, height } = this.gameApp.app.screen;
    const isWide = width >= 800;
    const cardY = Math.max(120, height * 0.19);
    const cardH = Math.min(380, height * 0.58);
    const simW = isWide ? width * 0.42 : width - 40;
    const simH = cardH;
    const simX = isWide ? width * 0.53 : width / 2 - simW / 2;
    const simY = isWide ? cardY : cardY + cardH + 15;

    const g = this.interactiveGraphic;
    g.clear();

    const stage = STAGES[this.currentStageIndex];

    if (stage.interactiveType === "thrust") {
      // Dynamic thruster simulation
      const shipX = simX + simW / 2;
      const hoverY = simY + simH * 0.45 + Math.sin(this.animTimer * 2) * 12;

      // Lander body
      g.roundRect(shipX - 25, hoverY - 20, 50, 40, 6);
      g.fill(0x334155);
      g.stroke({ color: 0x00d4ff, width: 2 });

      // Cockpit dome
      g.circle(shipX, hoverY - 12, 10);
      g.fill(0x00d4ff);

      // Thruster flame pulses
      const flameLen = 25 + Math.sin(this.animTimer * 10) * 10;
      g.moveTo(shipX - 12, hoverY + 20);
      g.lineTo(shipX + 12, hoverY + 20);
      g.lineTo(shipX, hoverY + 20 + flameLen);
      g.closePath();
      g.fill(0xff6b2b);

      // RCS steering indicators
      const rcsAlpha = (Math.sin(this.animTimer * 4) + 1) / 2;
      g.rect(shipX - 35, hoverY - 10, 8, 4);
      g.fill({ color: 0x00d4ff, alpha: rcsAlpha });
      g.rect(shipX + 27, hoverY - 10, 8, 4);
      g.fill({ color: 0x00d4ff, alpha: 1 - rcsAlpha });

      // Surface Landing Pad
      g.rect(simX + 40, simY + simH - 50, simW - 80, 8);
      g.fill(0x10b981);
    } else if (stage.interactiveType === "impact") {
      // Impact velocity threshold meter
      const barX = simX + 50;
      const barY = simY + 80;
      const barW = simW - 100;
      const barH = 26;

      // Safe zone (0 to 2.5 m/s)
      g.rect(barX, barY, barW * 0.35, barH);
      g.fill(0x10b981); // Green

      // Caution zone (2.5 to 7.0 m/s)
      g.rect(barX + barW * 0.35, barY, barW * 0.35, barH);
      g.fill(0xf59e0b); // Amber

      // Danger crater zone (7.0 to 15.0 m/s)
      g.rect(barX + barW * 0.7, barY, barW * 0.3, barH);
      g.fill(0xef4444); // Red

      // Animated needle
      const speedNorm = (Math.sin(this.animTimer * 1.5) + 1) / 2;
      const needleX = barX + speedNorm * barW;
      g.moveTo(needleX, barY - 10);
      g.lineTo(needleX - 6, barY - 2);
      g.lineTo(needleX + 6, barY - 2);
      g.closePath();
      g.fill(0xffffff);

      // Impact damage breakdown
      const isDamaged = speedNorm > 0.35;
      const isShattered = speedNorm > 0.7;
      g.roundRect(simX + 40, simY + 140, simW - 80, 110, 8);
      g.fill({ color: isShattered ? 0x3b1111 : isDamaged ? 0x3b2b11 : 0x113b1f, alpha: 0.8 });
      g.stroke({ color: isShattered ? 0xef4444 : isDamaged ? 0xf59e0b : 0x10b981, width: 2 });
    } else if (stage.interactiveType === "snapping") {
      // Base grid magnetic alignment & cantilever torque demo
      const cell = 46;
      const startGx = simX + simW / 2 - cell;
      const startGy = simY + simH * 0.45;

      // Root Foundation (0, 0)
      g.roundRect(startGx, startGy, cell, cell, 4);
      g.fill(0x334155);
      g.stroke({ color: 0x10b981, width: 2 });

      // Bedrock ground support line
      g.rect(startGx - cell, startGy + cell + 4, cell * 3, 6);
      g.fill(0x475569);

      // Snapped Cantilever arm
      g.roundRect(startGx + cell + 6, startGy, cell, cell, 4);
      g.fill(0xffd700);
      g.stroke({ color: 0xffa500, width: 2 });

      // Magnetic snap arcs
      const arcAlpha = (Math.sin(this.animTimer * 6) + 1) / 2;
      g.moveTo(startGx + cell, startGy + cell / 2);
      g.lineTo(startGx + cell + 6, startGy + cell / 2);
      g.stroke({ color: 0x00d4ff, width: 3, alpha: arcAlpha });
    } else if (stage.interactiveType === "economy") {
      // Power conduits & Adjacency bonus (+25% Hydroponics)
      const cell = 52;
      const gx = simX + simW / 2 - cell - 5;
      const gy = simY + simH * 0.42;

      // Crew Habitat
      g.roundRect(gx, gy, cell, cell, 6);
      g.fill(0xff6b2b);
      g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });

      // Adjacent Hydroponics Dome
      g.roundRect(gx + cell + 10, gy, cell, cell, 6);
      g.fill(0x39ff6b);
      g.stroke({ color: 0xffd700, width: 2 });

      // Glowing Golden Adjacency synergy link
      const pulse = (Math.sin(this.animTimer * 5) + 1) / 2;
      g.moveTo(gx + cell, gy + cell / 2);
      g.lineTo(gx + cell + 10, gy + cell / 2);
      g.stroke({ color: 0xffd700, width: 3, alpha: 0.4 + pulse * 0.6 });
    }
  }

  private buildNavigationControls(width: number, height: number): void {
    const cx = width / 2;
    const btnY = height - 55;
    const isNarrow = width < 580;
    const gap = 12;

    if (isNarrow) {
      const btnW = Math.floor((width - 40 - gap * 2) / 3);
      const startX = 20;

      const prevBtn = this.createButton("◀ PREV", btnW, 42, 0x1e293b, () => {
        if (this.currentStageIndex > 0) {
          this.currentStageIndex--;
          audioManager.playUIClick();
          this.renderTabs(width, height);
          this.renderStage(width, height);
        }
      });
      prevBtn.x = startX;
      prevBtn.y = btnY;
      this.container.addChild(prevBtn);

      const nextBtn = this.createButton("NEXT ▶", btnW, 42, 0x0284c7, () => {
        if (this.currentStageIndex < STAGES.length - 1) {
          this.currentStageIndex++;
          audioManager.playUIClick();
          this.renderTabs(width, height);
          this.renderStage(width, height);
        } else {
          this.launchMission();
        }
      });
      nextBtn.x = startX + btnW + gap;
      nextBtn.y = btnY;
      this.container.addChild(nextBtn);

      const launchBtn = this.createButton("LAUNCH 🚀", btnW, 42, 0x10b981, () => {
        this.launchMission();
      });
      launchBtn.x = startX + (btnW + gap) * 2;
      launchBtn.y = btnY;
      this.container.addChild(launchBtn);
    } else {
      const prevW = 140;
      const nextW = 160;
      const launchW = 180;
      const totalW = prevW + nextW + launchW + gap * 2;
      let curX = cx - totalW / 2;

      const prevBtn = this.createButton("◀ PREVIOUS", prevW, 42, 0x1e293b, () => {
        if (this.currentStageIndex > 0) {
          this.currentStageIndex--;
          audioManager.playUIClick();
          this.renderTabs(width, height);
          this.renderStage(width, height);
        }
      });
      prevBtn.x = curX;
      prevBtn.y = btnY;
      this.container.addChild(prevBtn);
      curX += prevW + gap;

      const nextBtn = this.createButton("NEXT PROTOCOL ▶", nextW, 42, 0x0284c7, () => {
        if (this.currentStageIndex < STAGES.length - 1) {
          this.currentStageIndex++;
          audioManager.playUIClick();
          this.renderTabs(width, height);
          this.renderStage(width, height);
        } else {
          this.launchMission();
        }
      });
      nextBtn.x = curX;
      nextBtn.y = btnY;
      this.container.addChild(nextBtn);
      curX += nextW + gap;

      const launchBtn = this.createButton("CERTIFY & LAUNCH", launchW, 42, 0x10b981, () => {
        this.launchMission();
      });
      launchBtn.x = curX;
      launchBtn.y = btnY;
      this.container.addChild(launchBtn);
    }
  }

  private createButton(
    label: string,
    bw: number,
    bh: number,
    color: number,
    onClick: () => void,
  ): Container {
    const btn = new Container();
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    bg.roundRect(0, 0, bw, bh, 6);
    bg.fill(color);
    bg.stroke({ color: 0xffffff, alpha: 0.2, width: 1 });

    const text = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 13,
        fontWeight: "700",
        fill: 0xffffff,
        letterSpacing: 1.5,
      }),
    });
    text.anchor.set(0.5, 0.5);
    text.x = bw / 2;
    text.y = bh / 2;

    btn.addChild(bg);
    btn.addChild(text);

    btn.on("pointertap", onClick);
    btn.on("pointerdown", onClick);
    btn.on("click", onClick);
    return btn;
  }

  private launchMission(): void {
    audioManager.playUIClick();
    audioManager.playModuleSnap();
    void this.gameApp.transitionTo("descend");
  }

  destroy(): void {
    this.gameApp.app.ticker.remove(this.onTick);
    this.container.removeChildren();
  }
}
