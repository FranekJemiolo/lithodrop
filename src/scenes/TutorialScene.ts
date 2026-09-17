/**
 * TutorialScene — Dropmaster Certification VR onboarding.
 *
 * Provides new pilots with:
 *   - Syndicate corporate flight instructions
 *   - Visual controls manual (WASD / Touch / Reticle explanation)
 *   - Interactive "START SIMULATION" & "SKIP" buttons
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";
import { audioManager } from "../engine/audio/AudioManager";

export class TutorialScene {
  readonly container: Container;
  private readonly gameApp: GameApp;

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();
  }

  start(): void {
    const { width, height } = this.gameApp.app.screen;
    const cx = width / 2;

    // Deep space background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill(0x050811);
    this.container.addChild(bg);

    // Subtle holographic grid lines
    const grid = new Graphics();
    for (let x = 0; x < width; x += 40) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 40) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.stroke({ color: 0x00d4ff, alpha: 0.04, width: 1 });
    this.container.addChild(grid);

    // Header banner
    const header = new Text({
      text: "DROPMASTER CERTIFICATION PROTOCOL",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: Math.min(width * 0.04, 28),
        fontWeight: "800",
        fill: 0x00d4ff,
        letterSpacing: 4,
      }),
    });
    header.anchor.set(0.5, 0);
    header.x = cx;
    header.y = Math.max(20, height * 0.05);
    this.container.addChild(header);

    const subheader = new Text({
      text: "ORBITAL SYNDICATE // AUTOMATED PILOT BRIEFING",
      style: new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: Math.min(width * 0.02, 13),
        fontWeight: "400",
        fill: 0x8b9ab5,
        letterSpacing: 2,
      }),
    });
    subheader.anchor.set(0.5, 0);
    subheader.x = cx;
    subheader.y = header.y + header.height + 6;
    this.container.addChild(subheader);

    // Three briefing cards
    const cardWidth = Math.min(320, (width - 80) / 3);
    const cardHeight = Math.min(260, height * 0.48);
    const cardY = subheader.y + subheader.height + Math.max(20, height * 0.04);

    const steps = [
      {
        num: "01",
        title: "THE DESCENT",
        badge: "PHYSICS FLIGHT",
        badgeColor: 0x00d4ff,
        lines: [
          "• W / Up Arrow / Screen Tap: Fire main engine against gravity.",
          "• A / D / Screen Swipe: Counter-torque RCS steering.",
          "• Reticle vector indicates velocity. Keep touchdown speed within safe limits.",
        ],
      },
      {
        num: "02",
        title: "BASE GRID",
        badge: "STRATEGY PHASE",
        badgeColor: 0x00ff88,
        lines: [
          "• Landed modules snap onto the planetary colony grid.",
          "• Power conduits connect Solar Arrays & Reactors to life support.",
          "• Proximity adjacency boosts credit & research yields.",
        ],
      },
      {
        num: "03",
        title: "CORPORATE TAX",
        badge: "SURVIVAL ECONOMY",
        badgeColor: 0xffaa00,
        lines: [
          "• Syndicate corporate tax increases after every single drop.",
          "• Balance mining yields and science labs with tax deadlines.",
          "• Insolvency results in immediate syndicate repossession!",
        ],
      },
    ];

    const totalWidth = steps.length * cardWidth + (steps.length - 1) * 20;
    const startX = cx - totalWidth / 2;

    steps.forEach((step, idx) => {
      const stepX = width > 768 ? startX + idx * (cardWidth + 20) : cx - cardWidth / 2;
      const stepY = width > 768 ? cardY : cardY + idx * (cardHeight / 3 + 10);

      const card = new Graphics();
      card.roundRect(stepX, stepY, cardWidth, cardHeight, 10);
      card.fill({ color: 0x0c1322, alpha: 0.85 });
      card.stroke({ color: step.badgeColor, alpha: 0.3, width: 1.5 });
      this.container.addChild(card);

      const numLabel = new Text({
        text: `${step.num}  ${step.badge}`,
        style: new TextStyle({
          fontFamily: "JetBrains Mono",
          fontSize: 11,
          fontWeight: "700",
          fill: step.badgeColor,
          letterSpacing: 1.5,
        }),
      });
      numLabel.x = stepX + 16;
      numLabel.y = stepY + 16;
      this.container.addChild(numLabel);

      const titleLabel = new Text({
        text: step.title,
        style: new TextStyle({
          fontFamily: "Outfit",
          fontSize: 18,
          fontWeight: "700",
          fill: 0xffffff,
          letterSpacing: 1,
        }),
      });
      titleLabel.x = stepX + 16;
      titleLabel.y = numLabel.y + 20;
      this.container.addChild(titleLabel);

      const bodyText = step.lines.join("\n\n");
      const bodyLabel = new Text({
        text: bodyText,
        style: new TextStyle({
          fontFamily: "Outfit",
          fontSize: 12,
          fontWeight: "400",
          fill: 0x94a3b8,
          wordWrap: true,
          wordWrapWidth: cardWidth - 32,
          lineHeight: 18,
        }),
      });
      bodyLabel.x = stepX + 16;
      bodyLabel.y = titleLabel.y + 30;
      this.container.addChild(bodyLabel);
    });

    // Action button: LAUNCH DROP
    this.buildLaunchButton(cx, height * 0.86);
  }

  private buildLaunchButton(cx: number, cy: number): void {
    const bw = 240;
    const bh = 50;

    const btnContainer = new Container();
    btnContainer.eventMode = "static";
    btnContainer.cursor = "pointer";

    const btnGlow = new Graphics();
    btnGlow.roundRect(cx - bw / 2 - 3, cy - bh / 2 - 3, bw + 6, bh + 6, 12);
    btnGlow.stroke({ color: 0x00d4ff, alpha: 0.4, width: 2 });

    const btnBg = new Graphics();
    btnBg.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
    btnBg.fill({ color: 0x00d4ff });

    const btnText = new Text({
      text: "INITIATE DROP",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 15,
        fontWeight: "800",
        fill: 0x070b14,
        letterSpacing: 2.5,
      }),
    });
    btnText.anchor.set(0.5, 0.5);
    btnText.x = cx;
    btnText.y = cy;

    btnContainer.addChild(btnGlow);
    btnContainer.addChild(btnBg);
    btnContainer.addChild(btnText);

    btnContainer.on("pointerover", () => {
      btnBg.clear();
      btnBg.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      btnBg.fill({ color: 0x33ddff });
    });

    btnContainer.on("pointerout", () => {
      btnBg.clear();
      btnBg.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      btnBg.fill({ color: 0x00d4ff });
    });

    btnContainer.on("pointertap", () => {
      audioManager.playUIClick();
      void this.gameApp.transitionTo("descend");
    });

    this.container.addChild(btnContainer);
  }

  destroy(): void {
    this.container.removeChildren();
  }
}
