/**
 * HazardRenderer — PixiJS Visual Warning Indicators for Environmental Hazards.
 *
 * Renders visual boundaries for:
 *   - Wind Shear (cyan horizontal wind streams and directional arrows)
 *   - Thermal Downdraft (amber column with downward warning chevrons)
 *   - Corrosive Cloud (toxic green/purple vapor volume with hazard boundary)
 *
 * Guarantees 1:1 pixel alignment between visual indicators and invisible Matter.js hitboxes.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { Hazard } from "../physics/HazardSystem";

export class HazardRenderer {
  readonly container: Container;
  private graphics: Graphics;
  private animTimer = 0;
  private hazards: Hazard[];

  constructor(hazards: Hazard[]) {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.hazards = hazards;

    this.buildStaticLabels();
    this.renderVisuals(0);
  }

  private buildStaticLabels(): void {
    for (const h of this.hazards) {
      if (h.type === "corrosive_cloud") {
        const label = new Text({
          text: "⚠ CORROSIVE ATMOSPHERE",
          style: new TextStyle({
            fontFamily: "JetBrains Mono",
            fontSize: 10,
            fontWeight: "700",
            fill: 0x00ff88,
            letterSpacing: 1,
          }),
        });
        label.x = h.bounds.x + 8;
        label.y = h.bounds.y + 8;
        this.container.addChild(label);
      } else if (h.type === "thermal_downdraft") {
        const label = new Text({
          text: "▼ THERMAL DOWNDRAFT 2.2×",
          style: new TextStyle({
            fontFamily: "JetBrains Mono",
            fontSize: 10,
            fontWeight: "700",
            fill: 0xffaa00,
            letterSpacing: 1,
          }),
        });
        label.x = h.bounds.x + 8;
        label.y = h.bounds.y + 8;
        this.container.addChild(label);
      } else if (h.type === "wind_shear") {
        const label = new Text({
          text: "▶ HIGH-ALTITUDE WIND SHEAR",
          style: new TextStyle({
            fontFamily: "JetBrains Mono",
            fontSize: 10,
            fontWeight: "700",
            fill: 0x00d4ff,
            letterSpacing: 1,
          }),
        });
        label.x = h.bounds.x + 12;
        label.y = h.bounds.y + 6;
        this.container.addChild(label);
      }
    }
  }

  update(deltaMS: number): void {
    this.animTimer += deltaMS * 0.002;
    this.renderVisuals(this.animTimer);
  }

  private renderVisuals(t: number): void {
    const g = this.graphics;
    g.clear();

    for (const h of this.hazards) {
      const { x, y, width: w, height: hgt } = h.bounds;

      if (h.type === "wind_shear") {
        // Semi-transparent cyan band
        g.rect(x, y, w, hgt);
        g.fill({ color: 0x00d4ff, alpha: 0.06 });

        // Boundary lines
        g.moveTo(x, y);
        g.lineTo(x + w, y);
        g.moveTo(x, y + hgt);
        g.lineTo(x + w, y + hgt);
        g.stroke({ color: 0x00d4ff, alpha: 0.25, width: 1 });

        // Animated wind streak streams
        for (let row = 0; row < 3; row++) {
          const streamY = y + 25 + row * (hgt / 3.5);
          const offset = (t * 80 + row * 90) % w;
          g.moveTo(x + offset, streamY);
          g.lineTo(x + offset + 40, streamY);
          g.stroke({ color: 0x00d4ff, alpha: 0.4, width: 1.5 });
        }
      } else if (h.type === "thermal_downdraft") {
        // Amber vertical column with shimmering pulse
        const pulse = 0.05 + Math.sin(t * 3) * 0.02;
        g.rect(x, y, w, hgt);
        g.fill({ color: 0xffaa00, alpha: pulse });

        // Vertical boundary borders
        g.moveTo(x, y);
        g.lineTo(x, y + hgt);
        g.moveTo(x + w, y);
        g.lineTo(x + w, y + hgt);
        g.stroke({ color: 0xffaa00, alpha: 0.35, width: 1.5 });

        // Downward chevrons
        const chevronOffset = (t * 40) % 60;
        for (let cy = y + 40; cy < y + hgt - 20; cy += 60) {
          const drawY = cy + chevronOffset;
          if (drawY > y + hgt - 10) continue;
          const midX = x + w / 2;
          g.moveTo(midX - 16, drawY - 8);
          g.lineTo(midX, drawY);
          g.lineTo(midX + 16, drawY - 8);
          g.stroke({ color: 0xffaa00, alpha: 0.3, width: 2 });
        }
      } else if (h.type === "corrosive_cloud") {
        // Toxic green/purple volume
        const pulse = 0.12 + Math.sin(t * 2) * 0.04;
        g.roundRect(x, y, w, hgt, 12);
        g.fill({ color: 0x00ff88, alpha: pulse });

        // Warning hatched border
        g.roundRect(x, y, w, hgt, 12);
        g.stroke({ color: 0x00ff88, alpha: 0.5, width: 1.5 });
      }
    }
  }

  destroy(): void {
    this.container.removeChildren();
  }
}
