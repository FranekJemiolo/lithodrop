/**
 * TitleScene — LithoDrop main title screen.
 *
 * Renders the animated title, tagline, and "Start Mission" button using
 * PixiJS graphics and text. The Start button also serves as the required
 * user gesture to unlock the Web Audio API AudioContext.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";
import { eventBus } from "../engine/events/EventBus";
import { audioManager } from "../engine/audio/AudioManager";

export class TitleScene {
  readonly container: Container;
  private readonly gameApp: GameApp;
  private animationFrameId: number | null = null;
  private time = 0;

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();
  }

  start(): void {
    this.buildBackground();
    this.buildTitle();
    this.buildStartButton();
    this.startAnimation();
  }

  private buildBackground(): void {
    const { width, height } = this.gameApp.app.screen;

    // Deep space gradient background (simulated with layered rectangles)
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill(0x070b14);
    this.container.addChild(bg);

    // Procedural star field
    const stars = new Graphics();
    const rng = mulberry32(42);
    for (let i = 0; i < 300; i++) {
      const x = rng() * width;
      const y = rng() * height;
      const r = rng() * 1.5 + 0.3;
      const alpha = rng() * 0.6 + 0.2;
      stars.circle(x, y, r);
      stars.fill({ color: 0xffffff, alpha });
    }
    this.container.addChild(stars);

    // Planet silhouette in background
    const planet = new Graphics();
    const px = width * 0.78;
    const py = height * 0.65;
    const pr = height * 0.35;
    planet.circle(px, py, pr);
    planet.fill({ color: 0x1a2e4a, alpha: 0.8 });

    // Planet rings (ellipses)
    planet.ellipse(px, py, pr * 1.6, pr * 0.22);
    planet.stroke({ color: 0x0099cc, alpha: 0.35, width: 3 });
    this.container.addChild(planet);
  }

  private buildTitle(): void {
    const { width, height } = this.gameApp.app.screen;
    const cx = width / 2;

    // LITHODROP wordmark
    const titleStyle = new TextStyle({
      fontFamily: "Outfit",
      fontSize: Math.min(width * 0.09, 80),
      fontWeight: "900",
      fill: 0x00d4ff,
      letterSpacing: 6,
      dropShadow: {
        color: 0x00d4ff,
        blur: 30,
        distance: 0,
        alpha: 0.6,
      },
    });

    const title = new Text({ text: "LITHODROP", style: titleStyle });
    title.anchor.set(0.5, 0.5);
    title.x = cx;
    title.y = height * 0.28;
    this.container.addChild(title);

    // Subtitle
    const subtitleStyle = new TextStyle({
      fontFamily: "Outfit",
      fontSize: Math.min(width * 0.025, 20),
      fontWeight: "400",
      fill: 0x8b9ab5,
      letterSpacing: 8,
    });

    const subtitle = new Text({ text: "ORBITAL  SYNDICATE", style: subtitleStyle });
    subtitle.anchor.set(0.5, 0.5);
    subtitle.x = cx;
    subtitle.y = height * 0.38;
    this.container.addChild(subtitle);

    // Tagline
    const taglineStyle = new TextStyle({
      fontFamily: "Outfit",
      fontSize: Math.min(width * 0.02, 16),
      fontWeight: "300",
      fill: 0x5a6a80,
      letterSpacing: 2,
    });

    const tagline = new Text({
      text: "Land. Snap. Survive.",
      style: taglineStyle,
    });
    tagline.anchor.set(0.5, 0.5);
    tagline.x = cx;
    tagline.y = height * 0.46;
    this.container.addChild(tagline);
  }

  private buildStartButton(): void {
    const { width, height } = this.gameApp.app.screen;
    const cx = width / 2;
    const buttonY = height * 0.58;
    const bw = Math.min(260, width * 0.4);
    const bh = 50;

    // Button background
    const btnBg = new Graphics();
    btnBg.roundRect(cx - bw / 2, buttonY - bh / 2, bw, bh, 8);
    btnBg.fill({ color: 0x00d4ff });

    // Button glow
    const btnGlow = new Graphics();
    btnGlow.roundRect(cx - bw / 2 - 4, buttonY - bh / 2 - 4, bw + 8, bh + 8, 12);
    btnGlow.stroke({ color: 0x00d4ff, alpha: 0.35, width: 2 });

    // Button text
    const btnText = new Text({
      text: "START MISSION",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 16,
        fontWeight: "700",
        fill: 0x070b14,
        letterSpacing: 3,
      }),
    });
    btnText.anchor.set(0.5, 0.5);
    btnText.x = cx;
    btnText.y = buttonY;

    // Interactive container for button
    const btnContainer = new Container();
    btnContainer.addChild(btnGlow);
    btnContainer.addChild(btnBg);
    btnContainer.addChild(btnText);
    btnContainer.eventMode = "static";
    btnContainer.cursor = "pointer";

    btnContainer.on("pointerover", () => {
      btnBg.clear();
      btnBg.roundRect(cx - bw / 2, buttonY - bh / 2, bw, bh, 8);
      btnBg.fill({ color: 0x33ddff });
    });

    btnContainer.on("pointerout", () => {
      btnBg.clear();
      btnBg.roundRect(cx - bw / 2, buttonY - bh / 2, bw, bh, 8);
      btnBg.fill({ color: 0x00d4ff });
    });

    const onStart = () => {
      // Unlock Web Audio API (must happen on user gesture)
      eventBus.emit("AUDIO_CONTEXT_UNLOCKED", {});
      audioManager.unlock();
      audioManager.playUIClick();
      // Transition to tutorial
      void this.gameApp.transitionTo("tutorial");
    };

    btnContainer.on("pointertap", onStart);
    btnContainer.on("pointerdown", onStart);
    btnContainer.on("click", onStart);

    this.container.addChild(btnContainer);

    // Secondary button: PLANETARY SECTORS
    const campY = height * 0.69;
    const campBg = new Graphics();
    campBg.roundRect(cx - bw / 2, campY - bh / 2, bw, bh, 8);
    campBg.fill({ color: 0x0f172a });
    campBg.stroke({ color: 0x00d4ff, alpha: 0.5, width: 1.5 });

    const campText = new Text({
      text: "PLANETARY SECTORS",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 14,
        fontWeight: "600",
        fill: 0x8b9ab5,
        letterSpacing: 2,
      }),
    });
    campText.anchor.set(0.5, 0.5);
    campText.x = cx;
    campText.y = campY;

    const campContainer = new Container();
    campContainer.addChild(campBg);
    campContainer.addChild(campText);
    campContainer.eventMode = "static";
    campContainer.cursor = "pointer";

    campContainer.on("pointerover", () => {
      campBg.clear();
      campBg.roundRect(cx - bw / 2, campY - bh / 2, bw, bh, 8);
      campBg.fill({ color: 0x1e293b });
      campBg.stroke({ color: 0x33ddff, alpha: 0.8, width: 2 });
    });

    campContainer.on("pointerout", () => {
      campBg.clear();
      campBg.roundRect(cx - bw / 2, campY - bh / 2, bw, bh, 8);
      campBg.fill({ color: 0x0f172a });
      campBg.stroke({ color: 0x00d4ff, alpha: 0.5, width: 1.5 });
    });

    const onCampaign = () => {
      eventBus.emit("AUDIO_CONTEXT_UNLOCKED", {});
      audioManager.unlock();
      audioManager.playUIClick();
      void this.gameApp.transitionTo("campaign");
    };

    campContainer.on("pointertap", onCampaign);
    campContainer.on("pointerdown", onCampaign);
    campContainer.on("click", onCampaign);

    this.container.addChild(campContainer);

    // Version tag
    const versionStyle = new TextStyle({
      fontFamily: "JetBrains Mono",
      fontSize: 11,
      fontWeight: "400",
      fill: 0x3a4a5a,
    });
    const version = new Text({ text: "v0.1.0 — ALPHA", style: versionStyle });
    version.anchor.set(0.5, 0.5);
    version.x = cx;
    version.y = height * 0.9;
    this.container.addChild(version);
  }

  private startAnimation(): void {
    const ticker = this.gameApp.app.ticker;
    const animate = () => {
      this.time += ticker.deltaMS / 1000;
      // Subtle title breathing
      const titleChild = this.container.children[2]; // title text
      if (titleChild) {
        titleChild.alpha = 0.85 + 0.15 * Math.sin(this.time * 1.2);
      }
    };
    ticker.add(animate);
  }

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

/** Fast deterministic pseudo-random number generator (for star field seeding) */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
