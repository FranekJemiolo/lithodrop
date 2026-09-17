/**
 * TechTree — Module and ability unlock system.
 *
 * Nodes are unlocked by spending Research Data points (produced by Science Lab).
 * Unlocked nodes persist in save state (IndexedDB via SaveManager).
 *
 * Tree structure (3 branches, organized on a Hex-Grid with axial coordinates [q, r]):
 *
 *   ENGINEERING (q = -1)
 *     ├─ improved_struts        (r = 0) Shock Absorber Strut capacity +50%
 *     ├─ reinforced_hull        (r = 1) All module impact tolerance +20%
 *     ├─ advanced_alloys        (r = 2) Foundation structural support +40t
 *     └─ quantum_anchoring      (r = 3) Reduces anchor power req by 30%
 *
 *   OPERATIONS (q = 0)
 *     ├─ fuel_efficiency        (r = 0) Thruster fuel consumption -20%
 *     ├─ overclocked_thrusters  (r = 1) Max thrust force +25%
 *     ├─ dual_engine            (r = 2) RCS rotation torque +40%
 *     └─ precision_landing      (r = 3) Impact tolerance for all modules +15%
 *
 *   SCIENCE (q = 1)
 *     ├─ data_compression       (r = 0) Science Lab data output +30%
 *     ├─ mineral_assay          (r = 1) Drill mineral output +25%
 *     ├─ bio_reactors           (r = 2) Hydroponics food output +50%
 *     └─ zero_point_tap         (r = 3) Fission Reactor power output +20%
 */

export type TechBranch = "engineering" | "operations" | "science";

export interface TechNode {
  id: string;
  displayName: string;
  description: string;
  branch: TechBranch;
  cost: number; // Research Data points
  q: number; // Hex axial coordinate q
  r: number; // Hex axial coordinate r
  /** IDs of nodes that must be unlocked first */
  prerequisites: string[];
  /** Whether this node has been unlocked */
  unlocked: boolean;
}

const RAW_NODES: Omit<TechNode, "unlocked">[] = [
  // ─── Engineering (q = -1) ─────────────────────────────────────────────────
  {
    id: "improved_struts",
    displayName: "Improved Struts",
    description: "Shock Absorber Strut structural capacity +50%.",
    branch: "engineering",
    cost: 5,
    q: -1,
    r: 0,
    prerequisites: [],
  },
  {
    id: "reinforced_hull",
    displayName: "Reinforced Hull",
    description: "All module impact tolerance +20%. Safely deliver fragile payloads.",
    branch: "engineering",
    cost: 12,
    q: -1,
    r: 1,
    prerequisites: ["improved_struts"],
  },
  {
    id: "advanced_alloys",
    displayName: "Advanced Alloys",
    description: "Titanium Foundation structural support capacity +40t.",
    branch: "engineering",
    cost: 20,
    q: -1,
    r: 2,
    prerequisites: ["reinforced_hull"],
  },
  {
    id: "quantum_anchoring",
    displayName: "Quantum Anchoring",
    description: "Anchor Project power requirement reduced by 30%.",
    branch: "engineering",
    cost: 50,
    q: -1,
    r: 3,
    prerequisites: ["advanced_alloys"],
  },

  // ─── Operations (q = 0) ───────────────────────────────────────────────────
  {
    id: "fuel_efficiency",
    displayName: "Fuel Efficiency",
    description: "Thruster fuel consumption -20%. More hang time in heavy gravity.",
    branch: "operations",
    cost: 8,
    q: 0,
    r: 0,
    prerequisites: [],
  },
  {
    id: "overclocked_thrusters",
    displayName: "Overclocked Thrusters",
    description: "Maximum thruster force +25%. Rapid deceleration capability.",
    branch: "operations",
    cost: 15,
    q: 0,
    r: 1,
    prerequisites: ["fuel_efficiency"],
  },
  {
    id: "dual_engine",
    displayName: "High-Torque RCS",
    description: "RCS steering torque +40%. Rapid response to crosswinds.",
    branch: "operations",
    cost: 25,
    q: 0,
    r: 2,
    prerequisites: ["overclocked_thrusters"],
  },
  {
    id: "precision_landing",
    displayName: "Precision Landing",
    description: "Impact tolerance for all modules +15%.",
    branch: "operations",
    cost: 40,
    q: 0,
    r: 3,
    prerequisites: ["dual_engine"],
  },

  // ─── Science (q = 1) ──────────────────────────────────────────────────────
  {
    id: "data_compression",
    displayName: "Data Compression",
    description: "Science Lab research data output +30%. Accelerates tech acquisition.",
    branch: "science",
    cost: 10,
    q: 1,
    r: 0,
    prerequisites: [],
  },
  {
    id: "mineral_assay",
    displayName: "Mineral Assay",
    description: "Deep Core Drill mineral extraction rate +25%.",
    branch: "science",
    cost: 15,
    q: 1,
    r: 1,
    prerequisites: ["data_compression"],
  },
  {
    id: "bio_reactors",
    displayName: "Bio-Reactors",
    description: "Hydroponics Dome food output +50%.",
    branch: "science",
    cost: 22,
    q: 1,
    r: 2,
    prerequisites: ["mineral_assay"],
  },
  {
    id: "zero_point_tap",
    displayName: "Zero-Point Tap",
    description: "Fission Reactor power generation +20%.",
    branch: "science",
    cost: 45,
    q: 1,
    r: 3,
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

  getBranchNodes(branch: TechBranch): TechNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.branch === branch)
      .sort((a, b) => a.cost - b.cost);
  }

  getAllNodes(): TechNode[] {
    return Array.from(this.nodes.values());
  }

  getNode(id: string): TechNode | undefined {
    return this.nodes.get(id);
  }

  canUnlock(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || node.unlocked) return false;
    return node.prerequisites.every((prereqId) => this.nodes.get(prereqId)?.unlocked ?? false);
  }

  isUnlocked(nodeId: string): boolean {
    return this.nodes.get(nodeId)?.unlocked ?? false;
  }

  unlock(nodeId: string, availableData: number): { success: boolean; cost: number } {
    const node = this.nodes.get(nodeId);
    if (!node || node.unlocked) return { success: false, cost: 0 };
    if (!this.canUnlock(nodeId)) return { success: false, cost: 0 };
    if (availableData < node.cost) return { success: false, cost: node.cost };

    node.unlocked = true;
    return { success: true, cost: node.cost };
  }

  serialize(): string[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.unlocked)
      .map((n) => n.id);
  }

  getUnlockedNodeIds(): string[] {
    return this.serialize();
  }

  toJSON(): string[] {
    return this.serialize();
  }

  deserialize(unlockedIds: string[]): void {
    for (const node of this.nodes.values()) {
      node.unlocked = unlockedIds.includes(node.id);
    }
  }

  restoreUnlockedNodes(unlockedIds: string[]): void {
    this.deserialize(unlockedIds);
  }

  getModifiers(): TechModifiers {
    const mods: TechModifiers = {
      impactToleranceMultiplier: 1.0,
      fuelConsumptionMultiplier: 1.0,
      thrusterForceMultiplier: 1.0,
      rcsTorqueMultiplier: 1.0,
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
    if (this.nodes.get("dual_engine")?.unlocked) mods.rcsTorqueMultiplier *= 1.4;
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
  rcsTorqueMultiplier: number;
  scienceLabMultiplier: number;
  drillMultiplier: number;
  hydroponicsMultiplier: number;
  reactorMultiplier: number;
  anchorPowerMultiplier: number;
}

export const techTree = new TechTree();
