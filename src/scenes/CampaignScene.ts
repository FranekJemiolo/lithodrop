/**
 * CampaignScene — Planetary Campaign Map & Sector Selection.
 *
 * Displays all 6 planetary targets defined in src/constants/planets.ts:
 *   - Luna Prime (Starter)
 *   - The Serpentine Rifts (High gravity canyon)
 *   - Thalassa (Ocean world, floating platforms)
 *   - Zephyrus (Gas giant upper atmosphere, microbursts)
 *   - The Outer Dark (Rogue cryo-world, isolation)
 *   - Vulcanis (Active volcanic hellscape, liquefaction)
 *
 * Selecting a planet updates GameApp.selectedPlanetId and launches the mission.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";
import { PLANETS, type PlanetDefinition } from "../constants/planets";
import { audioManager } from "../engine/audio/AudioManager";

export class CampaignScene {
  readonly container: Container;
  private readonly gameApp: GameApp;
  private cardContainers: Container[] = [];

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();
  }

  start(): void {
    const { width, height } = this.gameApp.app.screen;
    const cx = width / 2;

    // Void background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill(0x05070e);
    this.container.addChild(bg);

    // Subtle star field
    const stars = new Graphics();
    for (let i = 0; i < 150; i++) {
      const sx = (i * 97) % width;
      const sy = (i * 131) % height;
      const sr = i % 3 === 0 ? 1.5 : 0.8;
      stars.circle(sx, sy, sr);
      stars.fill({ color: 0xffffff, alpha: ((i % 5) + 1) * 0.1 });
    }
    this.container.addChild(stars);

    // Header title
    const title = new Text({
      text: "PLANETARY CAMPAIGN SECTORS",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: Math.min(width * 0.035, 26),
        fontWeight: "800",
        fill: 0x00d4ff,
        letterSpacing: 4,
      }),
    });
    title.anchor.set(0.5, 0);
    title.x = cx;
    title.y = Math.max(16, height * 0.03);
    this.container.addChild(title);

    const sub = new Text({
      text: "SELECT TARGET WORLD // ORBITAL SYNDICATE CLEARANCE",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: Math.min(width * 0.018, 12),
        fontWeight: "400",
        fill: 0x8b9ab5,
        letterSpacing: 2,
      }),
    });
    sub.anchor.set(0.5, 0);
    sub.x = cx;
    sub.y = title.y + title.height + 4;
    this.container.addChild(sub);

    // Planet Cards Grid (2 rows of 3, or responsive)
    this.buildPlanetCards(width, height);

    // Back to Title button
    this.buildBackButton(width, height);
  }

  private buildPlanetCards(width: number, height: number): void {
    const cols = width > 900 ? 3 : width > 600 ? 2 : 1;
    const rows = Math.ceil(PLANETS.length / cols);

    const cardWidth = Math.min(280, (width - 40 - (cols - 1) * 16) / cols);
    const cardHeight = Math.min(180, (height * 0.7) / rows);
    const startY = height * 0.14;
    const startX = (width - (cols * cardWidth + (cols - 1) * 16)) / 2;

    PLANETS.forEach((planet, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const px = startX + col * (cardWidth + 16);
      const py = startY + row * (cardHeight + 14);

      const card = this.createPlanetCard(planet, px, py, cardWidth, cardHeight);
      this.cardContainers.push(card);
      this.container.addChild(card);
    });
  }

  private createPlanetCard(
    planet: PlanetDefinition,
    x: number,
    y: number,
    w: number,
    h: number,
  ): Container {
    const card = new Container();
    card.eventMode = "static";
    card.cursor = "pointer";

    const isSelected = this.gameApp.selectedPlanetId === planet.id;

    // Background panel
    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 8);
    bg.fill({ color: 0x0c1322, alpha: 0.9 });
    bg.stroke({
      color: isSelected ? 0x00d4ff : 0x1e293b,
      width: isSelected ? 2 : 1,
    });
    card.addChild(bg);

    // Planet celestial icon (circle with atmospheric glow)
    const iconX = x + 24;
    const iconY = y + 26;
    const iconR = 12;

    const planetDisc = new Graphics();
    planetDisc.circle(iconX, iconY, iconR);
    planetDisc.fill(planet.terrainColor);
    planetDisc.stroke({ color: planet.skyColorHorizon, width: 2, alpha: 0.8 });
    card.addChild(planetDisc);

    // Name & Tagline
    const nameLabel = new Text({
      text: planet.displayName,
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 14,
        fontWeight: "700",
        fill: isSelected ? 0x00d4ff : 0xffffff,
        letterSpacing: 1,
      }),
    });
    nameLabel.x = iconX + iconR + 10;
    nameLabel.y = iconY - iconR;
    card.addChild(nameLabel);

    const taglineLabel = new Text({
      text: planet.tagline,
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 10,
        fontWeight: "400",
        fill: 0x64748b,
        fontStyle: "italic",
      }),
    });
    taglineLabel.x = nameLabel.x;
    taglineLabel.y = nameLabel.y + 16;
    card.addChild(taglineLabel);

    // Telemetry stats grid
    const statsY = y + 54;
    const stats = [
      `Gravity: ${planet.gravityMs2} m/s²`,
      `Atmosphere: ${Math.round(planet.atmosphereDensity * 100)}%`,
      `Quota: ${planet.quotaCreditsPerSecond} cr/s`,
      `Hazard: ${planet.hazards[0]?.type.replace("_", " ") ?? "None"}`,
    ];

    stats.forEach((stat, i) => {
      const sx = x + 16 + (i % 2) * (w / 2 - 8);
      const sy = statsY + Math.floor(i / 2) * 16;
      const statText = new Text({
        text: stat,
        style: new TextStyle({
          fontFamily: "JetBrains Mono",
          fontSize: 9,
          fill: 0x94a3b8,
        }),
      });
      statText.x = sx;
      statText.y = sy;
      card.addChild(statText);
    });

    // Deploy Button at bottom of card
    const btnH = 26;
    const btnY = y + h - btnH - 10;
    const btnW = w - 32;
    const btnX = x + 16;

    const btnBg = new Graphics();
    btnBg.roundRect(btnX, btnY, btnW, btnH, 5);
    btnBg.fill({ color: isSelected ? 0x00d4ff : 0x1e293b });

    const btnText = new Text({
      text: isSelected ? "DEPLOY NOW" : "SELECT SECTOR",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 11,
        fontWeight: "800",
        fill: isSelected ? 0x070b14 : 0x94a3b8,
        letterSpacing: 1.5,
      }),
    });
    btnText.anchor.set(0.5, 0.5);
    btnText.x = btnX + btnW / 2;
    btnText.y = btnY + btnH / 2;

    card.addChild(btnBg);
    card.addChild(btnText);

    card.on("pointerover", () => {
      bg.stroke({ color: 0x00d4ff, width: 2 });
    });

    card.on("pointerout", () => {
      if (this.gameApp.selectedPlanetId !== planet.id) {
        bg.stroke({ color: 0x1e293b, width: 1 });
      }
    });

    card.on("pointertap", () => {
      audioManager.playUIClick();
      this.gameApp.selectedPlanetId = planet.id;
      void this.gameApp.transitionTo("descend");
    });

    return card;
  }

  private buildBackButton(width: number, height: number): void {
    const btn = new Container();
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bw = 140;
    const bh = 36;
    const bx = width / 2 - bw / 2;
    const by = height - bh - 16;

    const bg = new Graphics();
    bg.roundRect(bx, by, bw, bh, 6);
    bg.fill({ color: 0x0f172a });
    bg.stroke({ color: 0x334155, width: 1 });

    const text = new Text({
      text: "◀ TITLE MENU",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 12,
        fontWeight: "700",
        fill: 0x94a3b8,
        letterSpacing: 1.5,
      }),
    });
    text.anchor.set(0.5, 0.5);
    text.x = bx + bw / 2;
    text.y = by + bh / 2;

    btn.addChild(bg);
    btn.addChild(text);

    btn.on("pointertap", () => {
      audioManager.playUIClick();
      void this.gameApp.transitionTo("title");
    });

    this.container.addChild(btn);
  }

  destroy(): void {
    this.container.removeChildren();
    this.cardContainers = [];
  }
}
