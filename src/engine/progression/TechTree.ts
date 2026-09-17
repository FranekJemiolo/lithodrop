/**
 * TechTree — Module and ability unlock system.
 *
 * Nodes are unlocked by spending Research Data points (produced by Science Lab).
 * Unlocked nodes persist in save state (IndexedDB via SaveManager).
 *
 * Tree structure (3 branches):
 *
 *   ENGINEERING (green)
 *     ├─ improved_struts        Shock Absorber Strut capacity +50%
 *     ├─ reinforced_hull        All module impact tolerance +20%
 *     ├─ advanced_alloys        Foundation structural support +40t
 *     └─ quantum_anchoring      [ANCHOR] Reduces anchor power req by 30%
 *
 *   OPERATIONS (cyan)
 *     ├─ fuel_efficiency        Thruster fuel consumption -20%
 *     ├─ overclocked_thrusters  Max thrust force +25%
 *     ├─ dual_engine            Allows two simultaneous RCS firings
 *     └─ precision_landing      Impact tolerance for all modules +15%
 *
 *   SCIENCE (gold)
 *     ├─ data_compression       Science Lab data output +30%
 *     ├─ mineral_assay          Drill mineral output +25%
 *     ├─ bio_reactors           Hydroponics food output +50%
 *     └─ zero_point_tap         Fission Reactor power output +20%
 */

export type TechBranch = "engineering" | "operations" | "science";

export interface TechNode {
  id: string;
  displayName: string;
  description: string;
  branch: TechBranch;
  cost: number; // Research Data points
  /** IDs of nodes that must be unlocked first */
  prerequisites: string[];
  /** Whether this node has been unlocked */
  unlocked: boolean;
}

const RAW_NODES: Omit<TechNode, "unlocked">[] = [
  // ─── Engineering ──────────────────────────────────────────────────────────
  {
    id: "improved_struts",
    displayName: "Improved Struts",
    description: "Shock Absorber Strut structural capacity +50%. First purchase on every run.",
    branch: "engineering",
    cost: 5,
    prerequisites: [],
  },
  {
    id: "reinforced_hull",
    displayName: "Reinforced Hull",
    description: "All module impact tolerance +20%. Safely deliver more fragile payloads.",
    branch: "engineering",
    cost: 12,
    prerequisites: ["improved_struts"],
  },
  {
    id: "advanced_alloys",
    displayName: "Advanced Alloys",
    description: "Titanium Foundation structural support capacity +40t. Build taller.",
    branch: "engineering",
    cost: 20,
    prerequisites: ["reinforced_hull"],
  },
  {
    id: "quantum_anchoring",
    displayName: "Quantum Anchoring",
    description: "Anchor Project power requirement reduced by 30%. Closer to the endgame.",
    branch: "engineering",
    cost: 50,
    prerequisites: ["advanced_alloys"],
  },

  // ─── Operations ───────────────────────────────────────────────────────────
  {
    id: "fuel_efficiency",
    displayName: "Fuel Efficiency",
    description: "Thruster fuel consumption -20%. More time in the air, less panic.",
    branch: "operations",
    cost: 8,
    prerequisites: [],
  },
  {
    id: "overclocked_thrusters",
    displayName: "Overclocked Thrusters",
    description: "Maximum thruster force +25%. Punches through dense atmospheres.",
    branch: "operations",
    cost: 15,
    prerequisites: ["fuel_efficiency"],
  },
  {
    id: "dual_engine",
    displayName: "Dual Engine Cluster",
    description: "Enables firing both main engine and full RCS simultaneously.",
    branch: "operations",
    cost: 25,
    prerequisites: ["overclocked_thrusters"],
  },
  {
    id: "precision_landing",
    displayName: "Precision Landing System",
    description: "All module impact tolerance +15%. Even the Hydroponics Dome becomes landable.",
    branch: "operations",
    cost: 35,
    prerequisites: ["dual_engine"],
  },

  // ─── Science ──────────────────────────────────────────────────────────────
  {
    id: "data_compression",
    displayName: "Data Compression",
    description: "Science Lab data output +30%. Research Data accumulates faster.",
    branch: "science",
    cost: 6,
    prerequisites: [],
  },
  {
    id: "mineral_assay",
    displayName: "Mineral Assay Protocol",
    description: "Deep Core Drill mineral output +25%. Every crystal counts.",
    branch: "science",
    cost: 14,
    prerequisites: ["data_compression"],
  },
  {
    id: "bio_reactors",
    displayName: "Bio-Reactors",
    description: "Hydroponics Dome food output +50%. Self-sufficiency on long campaigns.",
    branch: "science",
    cost: 22,
    prerequisites: ["mineral_assay"],
  },
  {
    id: "zero_point_tap",
    displayName: "Zero-Point Energy Tap",
    description: "Fission Reactor power output +20%. Enough to run everything.",
    branch: "science",
    cost: 45,
    prerequisites: ["bio_reactors"],
  },
];

export class TechTree {
  private readonly nodes: Map<string, TechNode>;

  constructor(unlockedIds: string[] = []) {
    this.nodes = new Map(
      RAW_NODES.map((n) => [n.id, { ...n, unlocked: unlockedIds.includes(n.id) }]),
    );
  }

  /** Get all nodes for a branch, ordered by cost. */
  getBranchNodes(branch: TechBranch): TechNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.branch === branch)
      .sort((a, b) => a.cost - b.cost);
  }

  /** Get all nodes. */
  getAllNodes(): TechNode[] {
    return Array.from(this.nodes.values());
  }

  /** Check if a node can be unlocked (prerequisites met, not already unlocked). */
  canUnlock(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || node.unlocked) return false;
    return node.prerequisites.every((prereqId) => this.nodes.get(prereqId)?.unlocked ?? false);
  }

  /**
   * Unlock a node, spending dataPoints.
   * @returns true if successfully unlocked
   */
  unlock(nodeId: string, availableData: number): { success: boolean; cost: number } {
    const node = this.nodes.get(nodeId);
    if (!node) return { success: false, cost: 0 };
    if (!this.canUnlock(nodeId)) return { success: false, cost: node.cost };
    if (availableData < node.cost) return { success: false, cost: node.cost };

    node.unlocked = true;
    return { success: true, cost: node.cost };
  }

  /** Get a specific node. */
  getNode(id: string): TechNode | undefined {
    return this.nodes.get(id);
  }

  /** Get all unlocked node IDs for save serialization. */
  toJSON(): string[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.unlocked)
      .map((n) => n.id);
  }

  /** Compute the combined modifiers from all unlocked nodes. */
  getModifiers(): TechModifiers {
    const mods: TechModifiers = {
      impactToleranceMultiplier: 1.0,
      fuelConsumptionMultiplier: 1.0,
      thrusterForceMultiplier: 1.0,
      scienceLabMultiplier: 1.0,
      drillMultiplier: 1.0,
      hydroponicsMultiplier: 1.0,
      reactorMultiplier: 1.0,
      anchorPowerMultiplier: 1.0,
    };

    if (this.nodes.get("reinforced_hull")?.unlocked) mods.impactToleranceMultiplier *= 1.2;
    if (this.nodes.get("precision_landing")?.unlocked) mods.impactToleranceMultiplier *= 1.15;
    if (this.nodes.get("fuel_efficiency")?.unlocked) mods.fuelConsumptionMultiplier *= 0.8;
    if (this.nodes.get("overclocked_thrusters")?.unlocked) mods.thrusterForceMultiplier *= 1.25;
    if (this.nodes.get("data_compression")?.unlocked) mods.scienceLabMultiplier *= 1.3;
    if (this.nodes.get("mineral_assay")?.unlocked) mods.drillMultiplier *= 1.25;
    if (this.nodes.get("bio_reactors")?.unlocked) mods.hydroponicsMultiplier *= 1.5;
    if (this.nodes.get("zero_point_tap")?.unlocked) mods.reactorMultiplier *= 1.2;
    if (this.nodes.get("quantum_anchoring")?.unlocked) mods.anchorPowerMultiplier *= 0.7;

    return mods;
  }
}

export interface TechModifiers {
  impactToleranceMultiplier: number;
  fuelConsumptionMultiplier: number;
  thrusterForceMultiplier: number;
  scienceLabMultiplier: number;
  drillMultiplier: number;
  hydroponicsMultiplier: number;
  reactorMultiplier: number;
  anchorPowerMultiplier: number;
}

export const techTree = new TechTree();
