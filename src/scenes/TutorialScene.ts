/**
 * TutorialScene — Dropmaster Certification VR onboarding (stub for M1).
 * Full implementation in Milestone 4.
 */

import { Container, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";

export class TutorialScene {
  readonly container: Container;
  private readonly gameApp: GameApp;

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();
  }

  start(): void {
    const { width, height } = this.gameApp.app.screen;
    const label = new Text({
      text: "DROPMASTER CERTIFICATION VR\n[Tutorial — Coming in M4]",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 24,
        fontWeight: "600",
        fill: 0x00d4ff,
        align: "center",
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.x = width / 2;
    label.y = height / 2;
    this.container.addChild(label);

    // Auto-advance to descent for now
    setTimeout(() => {
      void this.gameApp.transitionTo("descend");
    }, 2000);
  }
}
