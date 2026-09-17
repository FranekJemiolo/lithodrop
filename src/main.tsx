import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { HudRoot } from "./components/HUD/HudRoot";
import { GameApp } from "./engine/GameApp";

// ─── Bootstrap ──────────────────────────────────────────────────────────────
//
// Architecture: PixiJS canvas and React HUD are completely decoupled layers.
//
//   Layer 0 (z=0): PixiJS WebGL canvas  → game-canvas-container div
//   Layer 1 (z=10): React HUD overlay   → hud-root div
//
// GameApp manages the PixiJS application lifecycle. HudRoot manages all
// React UI components. Communication happens via the shared EventBus.
// ────────────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Initialize PixiJS game engine (attaches canvas to DOM)
  const gameApp = new GameApp();
  await gameApp.init();

  // 2. Mount React HUD overlay
  const hudRoot = document.getElementById("hud-root");
  if (!hudRoot) {
    throw new Error("LithoDrop: #hud-root element not found in DOM.");
  }

  ReactDOM.createRoot(hudRoot).render(
    <React.StrictMode>
      <HudRoot gameApp={gameApp} />
    </React.StrictMode>,
  );
}

bootstrap().catch((err) => {
  console.error("LithoDrop: Fatal bootstrap error", err);
});
