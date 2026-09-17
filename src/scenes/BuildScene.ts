/**
 * BuildScene — Base construction strategy phase (stub for M1/M3).
 * Full grid + drone implementation in Milestone 3.
 */

import { Container, Text, TextStyle } from "pixi.js";
import type { GameApp } from "../engine/GameApp";

export class BuildScene {
  readonly container: Container;
  private readonly gameApp: GameApp;

  constructor(gameApp: GameApp) {
    this.gameApp = gameApp;
    this.container = new Container();
  }

  start(): void {
    const { width, height } = this.gameApp.app.screen;
    const label = new Text({
      text: "BUILD PHASE\n[Grid & Logistics — Coming in M3]",
      style: new TextStyle({
        fontFamily: "Outfit",
        fontSize: 24,
        fontWeight: "600",
        fill: 0x39ff6b,
        align: "center",
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.x = width / 2;
    label.y = height / 2;
    this.container.addChild(label);
  }
}
