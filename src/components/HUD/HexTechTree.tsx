/**
 * HexTechTree — Interactive Hexagonal Grid Meta-Progression Tree.
 *
 * Renders an SVG layout of all 12 tech tree nodes across the 3 branches:
 *   - Engineering (Left, Green)
 *   - Operations (Center, Cyan)
 *   - Science (Right, Gold)
 *
 * Includes:
 *   - Connecting circuit traces showing prerequisite dependencies
 *   - Real-time research data balance
 *   - Instant physics engine upgrades
 *   - Exploit prevention: double-spend and negative balance protection
 */

import { useState } from "react";
import { techTree, type TechNode } from "../../engine/progression/TechTree";
import { audioManager } from "../../engine/audio/AudioManager";
import "./HexTechTree.css";

interface HexTechTreeProps {
  dataPoints: number;
  onSpendData: (cost: number) => void;
  onClose: () => void;
}

const HEX_RADIUS = 46;
const HEX_HORIZ_SPACING = 150;
const HEX_VERT_SPACING = 110;

function getHexPolygonPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

export function HexTechTree({ dataPoints, onSpendData, onClose }: HexTechTreeProps) {
  const [nodes, setNodes] = useState<TechNode[]>(techTree.getAllNodes());
  const [selectedNodeId, setSelectedNodeId] = useState<string>("improved_struts");

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];

  // Map each node to an (x, y) center on the 600x500 SVG canvas
  const canvasWidth = 620;
  const canvasHeight = 520;
  const centerX = canvasWidth / 2;
  const baseY = 80;

  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const x = centerX + node.q * HEX_HORIZ_SPACING;
    const y = baseY + node.r * HEX_VERT_SPACING + (Math.abs(node.q) % 2 !== 0 ? 25 : 0);
    nodePositions.set(node.id, { x, y });
  }

  const handleUnlock = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.unlocked) return;

    // Exploit guard: verify player has enough points and prerequisites
    if (dataPoints < node.cost || !techTree.canUnlock(nodeId)) {
      return;
    }

    const result = techTree.unlock(nodeId, dataPoints);
    if (result.success) {
      audioManager.playPowerUp();
      onSpendData(result.cost);
      setNodes([...techTree.getAllNodes()]);
    }
  };

  const isUnlocked = selectedNode?.unlocked ?? false;
  const canUnlock = !isUnlocked && techTree.canUnlock(selectedNode?.id ?? "");
  const hasEnoughData = dataPoints >= (selectedNode?.cost ?? Infinity);

  return (
    <div className="hex-tree-overlay" role="dialog" aria-label="Research & Technology Hex Tree">
      <div className="hex-tree-header">
        <div className="hex-tree-title-group">
          <h2 className="hex-tree-title">RESEARCH & TECHNOLOGY HEX-GRID</h2>
          <span className="hex-tree-data-balance">RESEARCH DATA: {dataPoints}</span>
        </div>
        <button className="hex-tree-close-btn" onClick={onClose} aria-label="Close Tech Tree">
          ✕
        </button>
      </div>

      <div className="hex-tree-content">
        {/* SVG Hexagonal Canvas */}
        <div className="hex-tree-canvas-container">
          <svg
            width={canvasWidth}
            height={canvasHeight}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            style={{ display: "block" }}
          >
            <defs>
              <linearGradient id="trace-active" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00ff88" />
                <stop offset="100%" stopColor="#00d4ff" />
              </linearGradient>
            </defs>

            {/* Circuit traces (prerequisite lines) */}
            {nodes.map((node) => {
              const toPos = nodePositions.get(node.id);
              if (!toPos) return null;

              return node.prerequisites.map((prereqId) => {
                const fromPos = nodePositions.get(prereqId);
                if (!fromPos) return null;

                const prereqNode = nodes.find((n) => n.id === prereqId);
                const isCircuitActive = (prereqNode?.unlocked ?? false) && node.unlocked;

                return (
                  <line
                    key={`${prereqId}->${node.id}`}
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke={isCircuitActive ? "url(#trace-active)" : "#1e293b"}
                    strokeWidth={isCircuitActive ? 3 : 1.5}
                    strokeDasharray={isCircuitActive ? undefined : "4 4"}
                    strokeOpacity={isCircuitActive ? 0.9 : 0.4}
                  />
                );
              });
            })}

            {/* Hexagonal Nodes */}
            {nodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const isNodeUnlocked = node.unlocked;
              const isNodeCanUnlock = !isNodeUnlocked && techTree.canUnlock(node.id);
              const isSelected = selectedNodeId === node.id;

              let nodeClass = "locked";
              if (isNodeUnlocked) nodeClass = "unlocked";
              else if (isNodeCanUnlock) nodeClass = "can-unlock";

              return (
                <g
                  key={node.id}
                  className={`hex-node-group ${nodeClass}`}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => {
                    audioManager.playUIClick();
                    setSelectedNodeId(node.id);
                  }}
                  style={{ outline: "none" }}
                >
                  <polygon
                    points={getHexPolygonPoints(0, 0, HEX_RADIUS)}
                    style={isSelected ? { stroke: "#fff", strokeWidth: 3.5 } : undefined}
                  />
                  <text className="hex-node-text-name" y={-6}>
                    {node.displayName.length > 14
                      ? node.displayName.split(" ")[0]
                      : node.displayName}
                  </text>
                  <text className="hex-node-text-cost" y={14}>
                    {isNodeUnlocked ? "✓ ACTIVE" : `${node.cost} DATA`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Sidebar Info & Action Panel */}
        <div className="hex-tree-sidebar">
          {selectedNode && (
            <>
              <div>
                <span className={`sidebar-branch-tag ${selectedNode.branch}`}>
                  {selectedNode.branch.toUpperCase()}
                </span>
                <h3 className="sidebar-title" style={{ marginTop: "8px" }}>
                  {selectedNode.displayName}
                </h3>
              </div>

              <div className="sidebar-desc">{selectedNode.description}</div>

              <div className="sidebar-cost">
                COST: {selectedNode.unlocked ? "PURCHASED" : `${selectedNode.cost} RESEARCH DATA`}
              </div>

              <button
                className={`sidebar-action-btn ${
                  isUnlocked ? "unlocked" : canUnlock && hasEnoughData ? "unlock" : "disabled"
                }`}
                disabled={isUnlocked || !canUnlock || !hasEnoughData}
                onClick={() => handleUnlock(selectedNode.id)}
              >
                {isUnlocked
                  ? "✓ RESEARCHED"
                  : !canUnlock
                    ? "PREREQUISITES REQUIRED"
                    : !hasEnoughData
                      ? "INSUFFICIENT DATA"
                      : `RESEARCH (${selectedNode.cost} DATA)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
