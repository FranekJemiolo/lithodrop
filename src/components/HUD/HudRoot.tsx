/**
 * HudRoot — Top-level React HUD component.
 *
 * Mounts as a transparent overlay over the PixiJS canvas.
 * Subscribes to PHASE_CHANGED events from the EventBus to swap
 * between HUD layouts (descent HUD vs. build HUD vs. overlays).
 *
 * Hosts:
 *   - Phase status labels
 *   - Directives & Special Contracts overlay drawer
 *   - Tech Tree progression modal (Engineering, Operations, Science)
 *   - Contract completion toast notifications
 *   - GameOver & Victory modal screens
 */

import { useEffect, useState } from "react";
import type { GameApp } from "../../engine/GameApp";
import type { GamePhase } from "../../engine/events/EventTypes";
import { eventBus } from "../../engine/events/EventBus";
import { specialContracts, type Contract } from "../../engine/progression/SpecialContracts";
import { techTree, type TechNode, type TechBranch } from "../../engine/progression/TechTree";
import { audioManager } from "../../engine/audio/AudioManager";
import "./HudRoot.css";

interface HudRootProps {
  gameApp: GameApp;
}

interface ToastData {
  title: string;
  rewardCredits: number;
  rewardData: number;
}

export function HudRoot({ gameApp }: HudRootProps) {
  const [phase, setPhase] = useState<GamePhase>(gameApp.phase);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [isTechTreeOpen, setIsTechTreeOpen] = useState(false);
  const [researchData, setResearchData] = useState(25); // starter research data points

  useEffect(() => {
    const unsubPhase = eventBus.on("PHASE_CHANGED", ({ to }) => {
      setPhase(to);
    });

    const unsubContract = eventBus.on("CONTRACT_COMPLETED", (data) => {
      audioManager.playPowerUp();
      setResearchData((prev) => prev + data.rewardData);
      setToast({
        title: data.title,
        rewardCredits: data.rewardCredits,
        rewardData: data.rewardData,
      });
      setTimeout(() => setToast(null), 3500);
    });

    return () => {
      unsubPhase();
      unsubContract();
    };
  }, []);

  return (
    <div className="hud-root-layout" aria-label="Game HUD overlay">
      {/* Top right HUD controls: Directives & Tech Tree */}
      {(phase === "descend" || phase === "build") && (
        <div className="directives-hud-corner" style={{ display: "flex", gap: "8px" }}>
          <DirectivesOverlay />
          {phase === "build" && (
            <button
              className="directives-toggle-btn"
              onClick={() => {
                audioManager.playUIClick();
                setIsTechTreeOpen(true);
              }}
              aria-label="Open Tech Tree"
            >
              🔬 TECH TREE
            </button>
          )}
        </div>
      )}

      {/* Tech Tree Modal */}
      {isTechTreeOpen && (
        <TechTreeModal
          dataPoints={researchData}
          onSpendData={(cost) => setResearchData((prev) => Math.max(0, prev - cost))}
          onClose={() => setIsTechTreeOpen(false)}
        />
      )}

      {/* Contract Completed Toast */}
      {toast && (
        <div className="contract-toast">
          <div className="toast-header mono">DIRECTIVE COMPLETE</div>
          <div className="toast-title">{toast.title}</div>
          <div className="toast-rewards">
            +{toast.rewardCredits} CR // +{toast.rewardData} DATA
          </div>
        </div>
      )}

      {/* Phase-specific HUD layers */}
      {phase === "title" && <TitleHud gameApp={gameApp} />}
      {phase === "descend" && <DescendHud />}
      {phase === "build" && <BuildHud />}
      {phase === "gameover" && <GameOverHud gameApp={gameApp} />}
      {phase === "victory" && <VictoryHud gameApp={gameApp} />}
    </div>
  );
}

// ─── Directives Overlay ───────────────────────────────────────────────────────

function DirectivesOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>(specialContracts.getContracts());

  useEffect(() => {
    const refresh = () => setContracts([...specialContracts.getContracts()]);
    const unsubTouch = eventBus.on("PAYLOAD_TOUCHDOWN", refresh);
    const unsubSnap = eventBus.on("MODULE_SNAPPED", refresh);
    const unsubTax = eventBus.on("TAX_ESCALATED", refresh);
    const unsubEcon = eventBus.on("ECONOMY_TICK", refresh);
    return () => {
      unsubTouch();
      unsubSnap();
      unsubTax();
      unsubEcon();
    };
  }, []);

  const activeCount = contracts.filter((c) => !c.isCompleted).length;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="directives-toggle-btn"
        onClick={() => {
          audioManager.playUIClick();
          setIsOpen(!isOpen);
        }}
        aria-label="Toggle Directives Drawer"
      >
        📋 DIRECTIVES ({activeCount})
      </button>

      {isOpen && (
        <div className="directives-drawer fade-in">
          <div className="directives-title">SYNDICATE DIRECTIVES</div>
          {contracts.map((c) => (
            <div key={c.id} className="contract-card">
              <div className="contract-header">
                <span className="contract-name">{c.title}</span>
                <span className="contract-badge">{c.corpDept}</span>
              </div>
              <div className="contract-desc">{c.description}</div>
              <div className="contract-rewards">
                +{c.rewardCredits} CR | +{c.rewardData} DATA
              </div>
              <div className="contract-progress-bar">
                <div
                  className="contract-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.round((c.currentProgress / c.targetCount) * 100))}%`,
                    backgroundColor: c.isCompleted ? "var(--color-colony)" : "var(--color-plasma)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tech Tree Modal ──────────────────────────────────────────────────────────

interface TechTreeModalProps {
  dataPoints: number;
  onSpendData: (cost: number) => void;
  onClose: () => void;
}

function TechTreeModal({ dataPoints, onSpendData, onClose }: TechTreeModalProps) {
  const [nodes, setNodes] = useState<TechNode[]>(techTree.getAllNodes());

  const handleUnlock = (nodeId: string) => {
    const res = techTree.unlock(nodeId, dataPoints);
    if (res.success) {
      audioManager.playPowerUp();
      onSpendData(res.cost);
      setNodes([...techTree.getAllNodes()]);
    }
  };

  const branches: Array<{ id: TechBranch; label: string; cls: string }> = [
    { id: "engineering", label: "ENGINEERING", cls: "engineering" },
    { id: "operations", label: "OPERATIONS", cls: "operations" },
    { id: "science", label: "SCIENCE", cls: "science" },
  ];

  return (
    <div className="techtree-modal">
      <div className="techtree-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h2 className="techtree-title">RESEARCH & TECHNOLOGY TREE</h2>
          <span className="techtree-data-badge">RESEARCH DATA: {dataPoints}</span>
        </div>
        <button className="techtree-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="techtree-branches">
        {branches.map((branch) => {
          const branchNodes = nodes
            .filter((n) => n.branch === branch.id)
            .sort((a, b) => a.cost - b.cost);

          return (
            <div key={branch.id} className="techtree-branch-col">
              <div className={`branch-title ${branch.cls}`}>⬡ {branch.label}</div>
              {branchNodes.map((node) => {
                const canUnlock = !node.unlocked && techTree.canUnlock(node.id);
                const hasEnoughData = dataPoints >= node.cost;

                return (
                  <div
                    key={node.id}
                    className={`tech-node-card ${node.unlocked ? "unlocked" : canUnlock ? "can-unlock" : ""}`}
                  >
                    <div className="node-name">{node.displayName}</div>
                    <div className="node-desc">{node.description}</div>
                    <div className="node-footer">
                      <span className="node-cost">{node.cost} DATA</span>
                      {node.unlocked ? (
                        <button className="node-btn unlocked" disabled>
                          ✓ ACTIVE
                        </button>
                      ) : canUnlock ? (
                        <button
                          className="node-btn unlock"
                          disabled={!hasEnoughData}
                          onClick={() => handleUnlock(node.id)}
                        >
                          {hasEnoughData ? "UNLOCK" : "NEED DATA"}
                        </button>
                      ) : (
                        <button className="node-btn locked" disabled>
                          LOCKED
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Phase HUD components ─────────────────────────────────────────────────────

function TitleHud({ gameApp: _gameApp }: { gameApp: GameApp }) {
  return null;
}

function DescendHud() {
  return (
    <div className="descend-hud-corner">
      <span className="hud-phase-label mono">▼ DESCEND PHASE</span>
    </div>
  );
}

function BuildHud() {
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
          onClick={() => {
            audioManager.playUIClick();
            void gameApp.transitionTo("title");
          }}
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
          onClick={() => {
            audioManager.playUIClick();
            void gameApp.transitionTo("campaign");
          }}
        >
          CAMPAIGN SECTORS →
        </button>
      </div>
    </div>
  );
}
