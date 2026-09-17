/**
 * SpecialContracts — Megacorp Corporate Directives and Secondary Objectives.
 *
 * Provides players with optional high-value contracts from the Orbital Syndicate.
 * Completing contracts awards lump-sum credits and research data points.
 *
 * System automatically listens to EventBus events:
 *   - PAYLOAD_TOUCHDOWN
 *   - MODULE_SNAPPED
 *   - TAX_ESCALATED
 *   - ECONOMY_TICK
 *   - QUOTA_MET
 */

import { eventBus } from "../events/EventBus";

export interface Contract {
  id: string;
  title: string;
  corpDept: "Logistics" | "Finance" | "Engineering" | "Security";
  description: string;
  targetCount: number;
  currentProgress: number;
  rewardCredits: number;
  rewardData: number;
  isCompleted: boolean;
  isVip?: boolean;
}

export interface VIPContract extends Contract {
  isVip: true;
  maxGForce: number;
  maxTiltDeg: number;
  isFailed: boolean;
  failureReason?: string;
}

export class SpecialContractsManager {
  private contracts: Map<string, Contract> = new Map();
  private unsubs: Array<() => void> = [];
  private activeVipContract: VIPContract | null = null;
  private nextVipId = 1;

  constructor() {
    this.initDefaultContracts();
    this.bindEvents();
  }

  private initDefaultContracts(): void {
    const list: Contract[] = [
      {
        id: "first_touchdown",
        title: "Proof of Competence",
        corpDept: "Logistics",
        description: "Successfully land your first payload intact.",
        targetCount: 1,
        currentProgress: 0,
        rewardCredits: 500,
        rewardData: 2,
        isCompleted: false,
      },
      {
        id: "featherfall",
        title: "Featherfall Protocol",
        corpDept: "Engineering",
        description: "Land a module with 0% impact damage (within safe tolerance).",
        targetCount: 1,
        currentProgress: 0,
        rewardCredits: 800,
        rewardData: 3,
        isCompleted: false,
      },
      {
        id: "power_grid_mesh",
        title: "Grid Energization",
        corpDept: "Engineering",
        description: "Snap 3 active power or resource modules onto the colony grid.",
        targetCount: 3,
        currentProgress: 0,
        rewardCredits: 1200,
        rewardData: 5,
        isCompleted: false,
      },
      {
        id: "tax_survival",
        title: "Syndicate Solvency",
        corpDept: "Finance",
        description: "Withstand 2 corporate tax bracket escalations without insolvency.",
        targetCount: 2,
        currentProgress: 0,
        rewardCredits: 1500,
        rewardData: 5,
        isCompleted: false,
      },
      {
        id: "high_yield_economy",
        title: "Resource Monopoly",
        corpDept: "Finance",
        description: "Achieve a sustained net production rate of at least 40 cr/sec.",
        targetCount: 40,
        currentProgress: 0,
        rewardCredits: 2000,
        rewardData: 8,
        isCompleted: false,
      },
      {
        id: "anchor_clearance",
        title: "Anchor Authorization",
        corpDept: "Security",
        description: "Sustain required planetary quota and authorize the Anchor Project.",
        targetCount: 1,
        currentProgress: 0,
        rewardCredits: 5000,
        rewardData: 15,
        isCompleted: false,
      },
    ];

    for (const c of list) {
      this.contracts.set(c.id, c);
    }
  }

  private bindEvents(): void {
    // 1. Touchdown checks
    this.unsubs.push(
      eventBus.on("PAYLOAD_TOUCHDOWN", (ev) => {
        if (ev.survived) {
          this.advanceProgress("first_touchdown", 1);
          if (ev.impactDamage === 0) {
            this.advanceProgress("featherfall", 1);
          }
          if (
            this.activeVipContract &&
            !this.activeVipContract.isFailed &&
            !this.activeVipContract.isCompleted
          ) {
            this.advanceProgress(this.activeVipContract.id, 1);
          }
        }
      }),
    );

    // 2. Module snapped checks
    this.unsubs.push(
      eventBus.on("MODULE_SNAPPED", () => {
        this.advanceProgress("power_grid_mesh", 1);
      }),
    );

    // 3. Tax escalation checks
    this.unsubs.push(
      eventBus.on("TAX_ESCALATED", () => {
        this.advanceProgress("tax_survival", 1);
      }),
    );

    // 4. Economy ticks
    this.unsubs.push(
      eventBus.on("ECONOMY_TICK", (ev) => {
        if (ev.netPerSecond >= 40) {
          this.advanceProgress("high_yield_economy", ev.netPerSecond);
        }
      }),
    );

    // 5. Quota / Anchor checks
    this.unsubs.push(
      eventBus.on("ANCHOR_AUTHORIZED", () => {
        this.advanceProgress("anchor_clearance", 1);
      }),
    );
  }

  generateVipContract(options?: Partial<VIPContract>): VIPContract {
    const id = options?.id ?? `vip_${this.nextVipId++}_${Date.now()}`;
    const archetypes = [
      {
        title: "VIP: Syndicate Executive Diplomat",
        corpDept: "Security" as const,
        description:
          "Transport high-ranking corporate executive. Strict G-force limit: 2.8G, max tilt: 22°.",
        maxGForce: 2.8,
        maxTiltDeg: 22,
        rewardCredits: 3500,
        rewardData: 8,
      },
      {
        title: "VIP: Unstable Quantum Core",
        corpDept: "Engineering" as const,
        description:
          "Deliver delicate quantum computing core. Inertial damping limit: 3.2G, max tilt: 25°.",
        maxGForce: 3.2,
        maxTiltDeg: 25,
        rewardCredits: 4000,
        rewardData: 10,
      },
      {
        title: "VIP: Bio-Specimen Cryo-Stasis",
        corpDept: "Logistics" as const,
        description: "Transport fragile cryogenic bio-specimens. Shock limit: 2.5G, max tilt: 18°.",
        maxGForce: 2.5,
        maxTiltDeg: 18,
        rewardCredits: 4500,
        rewardData: 12,
      },
      {
        title: "VIP: Treasury Audit Delegate",
        corpDept: "Finance" as const,
        description:
          "Deliver chief financial officer with zero turbulence: 3.0G limit, max tilt: 20°.",
        maxGForce: 3.0,
        maxTiltDeg: 20,
        rewardCredits: 5000,
        rewardData: 15,
      },
    ];

    const template = archetypes[(this.nextVipId - 1) % archetypes.length];
    const vipContract: VIPContract = {
      id,
      title: options?.title ?? template.title,
      corpDept: options?.corpDept ?? template.corpDept,
      description: options?.description ?? template.description,
      targetCount: 1,
      currentProgress: 0,
      rewardCredits: options?.rewardCredits ?? template.rewardCredits,
      rewardData: options?.rewardData ?? template.rewardData,
      isCompleted: false,
      isVip: true,
      maxGForce: options?.maxGForce ?? template.maxGForce,
      maxTiltDeg: options?.maxTiltDeg ?? template.maxTiltDeg,
      isFailed: false,
      failureReason: undefined,
    };

    this.contracts.set(id, vipContract);
    return vipContract;
  }

  setActiveVipContract(contract: VIPContract | null): void {
    this.activeVipContract = contract;
  }

  getActiveVipContract(): VIPContract | null {
    return this.activeVipContract;
  }

  failVipContract(contractId: string, reason: string): void {
    const contract = this.contracts.get(contractId) as VIPContract | undefined;
    if (!contract || !contract.isVip || contract.isFailed) return;

    contract.isFailed = true;
    contract.failureReason = reason;
    eventBus.emit("VIP_CONTRACT_FAILED", {
      contractId,
      reason,
      gForce: 0,
      tiltDeg: 0,
    });
  }

  advanceProgress(contractId: string, amount: number): void {
    const contract = this.contracts.get(contractId);
    if (!contract || contract.isCompleted) return;
    if (contract.isVip && (contract as VIPContract).isFailed) return;

    if (contractId === "high_yield_economy") {
      contract.currentProgress = Math.max(contract.currentProgress, amount);
    } else {
      contract.currentProgress += amount;
    }

    if (contract.currentProgress >= contract.targetCount) {
      contract.currentProgress = contract.targetCount;
      contract.isCompleted = true;
      this.claimContract(contract);
    }
  }

  private claimContract(contract: Contract): void {
    eventBus.emit("CONTRACT_COMPLETED", {
      contractId: contract.id,
      title: contract.title,
      rewardCredits: contract.rewardCredits,
      rewardData: contract.rewardData,
    });
  }

  getContracts(): Contract[] {
    return Array.from(this.contracts.values());
  }

  getActiveContracts(): Contract[] {
    return Array.from(this.contracts.values()).filter((c) => !c.isCompleted);
  }

  getCompletedContracts(): Contract[] {
    return Array.from(this.contracts.values()).filter((c) => c.isCompleted);
  }

  getContract(id: string): Contract | undefined {
    return this.contracts.get(id);
  }

  serialize(): Record<
    string,
    {
      currentProgress: number;
      isCompleted: boolean;
      isVip?: boolean;
      isFailed?: boolean;
      failureReason?: string;
      maxGForce?: number;
      maxTiltDeg?: number;
    }
  > {
    const result: Record<
      string,
      {
        currentProgress: number;
        isCompleted: boolean;
        isVip?: boolean;
        isFailed?: boolean;
        failureReason?: string;
        maxGForce?: number;
        maxTiltDeg?: number;
      }
    > = {};
    for (const [id, c] of this.contracts.entries()) {
      const vip = c.isVip ? (c as VIPContract) : null;
      result[id] = {
        currentProgress: c.currentProgress,
        isCompleted: c.isCompleted,
        isVip: c.isVip,
        isFailed: vip?.isFailed,
        failureReason: vip?.failureReason,
        maxGForce: vip?.maxGForce,
        maxTiltDeg: vip?.maxTiltDeg,
      };
    }
    return result;
  }

  deserialize(
    data: Record<
      string,
      {
        currentProgress: number;
        isCompleted: boolean;
        isVip?: boolean;
        isFailed?: boolean;
        failureReason?: string;
        maxGForce?: number;
        maxTiltDeg?: number;
      }
    >,
  ): void {
    for (const [id, state] of Object.entries(data)) {
      const contract = this.contracts.get(id);
      if (contract) {
        contract.currentProgress = state.currentProgress;
        contract.isCompleted = state.isCompleted;
        if (state.isVip) {
          const vip = contract as VIPContract;
          vip.isFailed = Boolean(state.isFailed);
          vip.failureReason = state.failureReason;
        }
      } else if (state.isVip) {
        // Restore dynamic VIP contract
        const vip: VIPContract = {
          id,
          title: "VIP Contract",
          corpDept: "Security",
          description: "Restored VIP payload delivery directive.",
          targetCount: 1,
          currentProgress: state.currentProgress,
          rewardCredits: 3500,
          rewardData: 8,
          isCompleted: state.isCompleted,
          isVip: true,
          maxGForce: state.maxGForce ?? 3.0,
          maxTiltDeg: state.maxTiltDeg ?? 25,
          isFailed: Boolean(state.isFailed),
          failureReason: state.failureReason,
        };
        this.contracts.set(id, vip);
      }
    }
  }

  destroy(): void {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
  }
}

export const specialContracts = new SpecialContractsManager();
