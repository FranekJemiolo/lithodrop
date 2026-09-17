/**
 * DescendScene — Lander physics descent phase (stub for M1/M2).
 * Full physics implementation in Milestone 2.
 */

import { Container, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";

export class DescendScene {
  readonly container: Container;
  private readonly gameApp: GameApp;

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();
  }

  start(): void {
    const { width, height } = this.gameApp.app.screen;
    const label = new Text({
      text: "DESCENT PHASE\n[Physics Engine — Coming in M2]",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 24,
        fontWeight: "600",
        fill: 0xff6b2b,
        align: "center",
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.x = width / 2;
    label.y = height / 2;
    this.container.addChild(label);
  }
}
