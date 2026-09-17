/**
 * HudRoot — Top-level React HUD component.
 *
 * Mounts as a transparent overlay over the PixiJS canvas.
 * Subscribes to PHASE_CHANGED events from the EventBus to swap
 * between HUD layouts (descent HUD vs. build HUD vs. overlays).
 *
 * pointer-events: none by default — individual interactive elements
 * within each HUD child must opt in with pointer-events: auto.
 */

import { useEffect, useState } from "react";
import type { GameApp } from "../../engine/GameApp";
import type { GamePhase } from "../../engine/events/EventTypes";
import { eventBus } from "../../engine/events/EventBus";
import "./HudRoot.css";

interface HudRootProps {
  gameApp: GameApp;
}

export function HudRoot({ gameApp }: HudRootProps) {
  const [phase, setPhase] = useState<GamePhase>(gameApp.phase);

  useEffect(() => {
    const unsub = eventBus.on("PHASE_CHANGED", ({ to }) => {
      setPhase(to);
    });
    return unsub;
  }, []);

  return (
    <div className="hud-root-layout" aria-label="Game HUD overlay">
      {/* Phase-specific HUD layers */}
      {phase === "title" && <TitleHud gameApp={gameApp} />}
      {phase === "descend" && <DescendHud />}
      {phase === "build" && <BuildHud />}
      {phase === "gameover" && <GameOverHud gameApp={gameApp} />}
      {phase === "victory" && <VictoryHud gameApp={gameApp} />}
    </div>
  );
}

// ─── Phase HUD components (stubs expanded in later milestones) ────────────────

function TitleHud({ gameApp: _gameApp }: { gameApp: GameApp }) {
  // Title screen HUD: nothing extra rendered here; PixiJS canvas handles
  // the title screen rendering entirely.
  return null;
}

function DescendHud() {
  // Descent HUD: Telemetry Reticle, fuel, velocity vector.
  // Full implementation in Milestone 2.
  return (
    <div className="descend-hud-corner">
      <span className="hud-phase-label mono">▼ DESCEND PHASE</span>
    </div>
  );
}

function BuildHud() {
  // Build HUD: Corporate Ticker, Module Dock, Blueprint Mode toggle.
  // Full implementation in Milestone 3 + 4.
  return (
    <div className="build-hud-corner">
      <span className="hud-phase-label mono colony-text">⬡ BUILD PHASE</span>
    </div>
  );
}

function GameOverHud({ gameApp }: { gameApp: GameApp }) {
  return (
    <div className="fullscreen-overlay fade-in">
      <div className="overlay-panel glass-panel">
        <h1 className="overlay-title danger-text">YOU'RE FIRED</h1>
        <p className="overlay-body">
          Corporate has reviewed your performance. The colony has been abandoned.
        </p>
        <button
          id="retry-btn"
          className="btn btn-ember"
          onClick={() => void gameApp.transitionTo("title")}
        >
          TRY AGAIN
        </button>
      </div>
    </div>
  );
}

function VictoryHud({ gameApp }: { gameApp: GameApp }) {
  return (
    <div className="fullscreen-overlay fade-in">
      <div className="overlay-panel glass-panel">
        <h1 className="overlay-title colony-text">PLANET CONQUERED</h1>
        <p className="overlay-body">
          The Anchor Project is online. The Megacorp congratulates your efficiency.
        </p>
        <button
          id="next-planet-btn"
          className="btn btn-plasma"
          onClick={() => void gameApp.transitionTo("title")}
        >
          NEXT PLANET →
        </button>
      </div>
    </div>
  );
}
