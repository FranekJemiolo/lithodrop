/**
 * EconomyEngine — Credit accumulation, tax deduction, and quota tracking.
 *
 * Ticks every 1000ms. Reads ResourceFlowSummary from DependencyGraph,
 * calculates gross income, deducts corporate tax, checks quota and
 * bankruptcy conditions.
 *
 * Events emitted:
 *   ECONOMY_TICK    — every second with full economy state
 *   BANKRUPTCY      — when credits < 0 and netPerSecond < 0
 *   QUOTA_MET       — when quota is first sustained for required duration
 *   ANCHOR_AUTHORIZED — quota sustained for quotaSustainMs
 */

import { eventBus } from "../events/EventBus";
import type { DependencyGraph } from "../grid/DependencyGraph";
import type { GridState } from "../grid/GridState";
import { TaxScheduler } from "./TaxScheduler";

export interface EconomyState {
  credits: number;
  creditsPerSecond: number;
  taxPerSecond: number;
  netPerSecond: number;
  upkeepDeficit: boolean;
  quotaSustainedMs: number;
}

export interface EconomyEngineOptions {
  initialCredits?: number;
  quotaCreditsPerSecond: number;
  quotaSustainMs: number;
  initialTaxTier?: number;
}

export class EconomyEngine {
  private credits: number;
  private readonly quota: number;
  private readonly quotaSustainMs: number;

  private quotaSustainedMs = 0;
  private quotaAchieved = false;
  private anchorAuthorized = false;

  private readonly taxScheduler: TaxScheduler;

  // Tick accumulator: tick fires every 1000ms
  private tickAccumulator = 0;

  constructor(options: EconomyEngineOptions) {
    this.credits = options.initialCredits ?? 2000;
    this.quota = options.quotaCreditsPerSecond;
    this.quotaSustainMs = options.quotaSustainMs;
    this.taxScheduler = new TaxScheduler(options.initialTaxTier ?? 0);
  }

  /** Current credit balance */
  get currentCredits(): number {
    return this.credits;
  }

  /** Add a lump-sum credit payment (Drop Bounty, contract payout, etc.) */
  addCredits(amount: number): void {
    this.credits += amount;
  }

  /** Deduct credits for module purchase */
  spendCredits(amount: number): boolean {
    if (this.credits < amount) return false;
    this.credits -= amount;
    return true;
  }

  /**
   * Advance the economy by deltaMS.
   * Fires the ECONOMY_TICK event if 1000ms has elapsed.
   *
   * @param deltaMS - Time elapsed since last frame (from PixiJS ticker)
   * @param graph - Current dependency graph (for flow summary)
   * @param grid - Current grid state
   */
  tick(deltaMS: number, graph: DependencyGraph, grid: GridState): void {
    this.taxScheduler.tick(deltaMS);
    this.tickAccumulator += deltaMS;

    if (this.tickAccumulator >= 1000) {
      this.tickAccumulator -= 1000;
      this.processTick(graph, grid);
    }
  }

  private processTick(graph: DependencyGraph, grid: GridState): void {
    const flow = graph.rebuild(grid);

    // Income: minerals + data + food produce credits
    // Rate: 1 mineral/s = 1.0 cr/s, 1 data/s = 3.0 cr/s, 1 food/s = 1.5 cr/s
    const grossIncome =
      flow.mineralsPerSecond * 1.0 + flow.dataPerSecond * 3.0 + flow.foodPerSecond * 1.5;

    const taxRate = this.taxScheduler.currentTaxRate;
    const net = grossIncome - taxRate;

    this.credits += net;

    const upkeepDeficit = flow.powerConsumed > flow.powerGenerated;

    const state: EconomyState = {
      credits: this.credits,
      creditsPerSecond: grossIncome,
      taxPerSecond: taxRate,
      netPerSecond: net,
      upkeepDeficit,
      quotaSustainedMs: this.quotaSustainedMs,
    };

    eventBus.emit("ECONOMY_TICK", {
      credits: this.credits,
      creditsPerSecond: grossIncome,
      taxPerSecond: taxRate,
      netPerSecond: net,
      upkeepDeficit,
    });

    // Check bankruptcy
    if (this.credits < 0 && net < 0) {
      eventBus.emit("BANKRUPTCY", {});
      return;
    }

    // Quota tracking
    if (grossIncome >= this.quota) {
      this.quotaSustainedMs += 1000;

      if (!this.quotaAchieved) {
        eventBus.emit("QUOTA_MET", {
          creditsPerSecond: grossIncome,
          requiredCreditsPerSecond: this.quota,
        });
        this.quotaAchieved = true;
      }

      if (!this.anchorAuthorized && this.quotaSustainedMs >= this.quotaSustainMs) {
        this.anchorAuthorized = true;
        eventBus.emit("ANCHOR_AUTHORIZED", {});
      }
    } else {
      // Quota dropped — reset sustain timer
      this.quotaSustainedMs = 0;
      this.quotaAchieved = false;
    }

    void state; // Used for future save serialization
  }

  /** Serialize for save state */
  toJSON(): { credits: number; currentTaxTier: number; upkeepDeficit: boolean } {
    return {
      credits: this.credits,
      currentTaxTier: this.taxScheduler.tier,
      upkeepDeficit: false, // recalculated on load
    };
  }
}
