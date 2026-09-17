/**
 * TaxScheduler — Corporate tax escalation over time.
 *
 * Every 180 seconds (3 minutes), the tax tier increments by 1.
 * The tax rate is deducted from credits each second by EconomyEngine.
 *
 * Tax tiers:
 *   Tier 0:  2 cr/s  (starting rate)
 *   Tier 1:  5 cr/s  (first escalation at 3 min)
 *   Tier 2: 12 cr/s
 *   Tier 3: 25 cr/s
 *   Tier 4: 50 cr/s
 *   Tier 5: 90 cr/s  (maximum)
 */

import { eventBus } from "../events/EventBus";

export const TAX_TIERS = [2, 5, 12, 25, 50, 90] as const;
export const TAX_ESCALATION_INTERVAL_MS = 180_000; // 3 minutes
export const MAX_TAX_TIER = TAX_TIERS.length - 1;

export class TaxScheduler {
  private currentTier: number;
  private timeUntilNextEscalationMs: number;

  constructor(initialTier = 0) {
    this.currentTier = Math.min(Math.max(initialTier, 0), MAX_TAX_TIER);
    this.timeUntilNextEscalationMs = TAX_ESCALATION_INTERVAL_MS;
  }

  /** Current tax rate in credits per second */
  get currentTaxRate(): number {
    return TAX_TIERS[this.currentTier];
  }

  /** Current tax tier index [0–5] */
  get tier(): number {
    return this.currentTier;
  }

  /** Milliseconds until the next tax escalation */
  get msUntilNextEscalation(): number {
    return this.timeUntilNextEscalationMs;
  }

  /**
   * Advance the tax scheduler by deltaMS.
   * Returns true if an escalation occurred this tick.
   */
  tick(deltaMS: number): boolean {
    if (this.currentTier >= MAX_TAX_TIER) return false;

    this.timeUntilNextEscalationMs -= deltaMS;

    if (this.timeUntilNextEscalationMs <= 0) {
      this.currentTier = Math.min(this.currentTier + 1, MAX_TAX_TIER);
      this.timeUntilNextEscalationMs = TAX_ESCALATION_INTERVAL_MS;

      eventBus.emit("TAX_ESCALATED", {
        newTier: this.currentTier,
        taxRatePerSecond: this.currentTaxRate,
      });

      return true;
    }

    return false;
  }

  /** Serialize for save state */
  toJSON(): { tier: number; msUntilNextEscalation: number } {
    return {
      tier: this.currentTier,
      msUntilNextEscalation: this.timeUntilNextEscalationMs,
    };
  }

  /** Restore from save state */
  static fromJSON(data: { tier: number; msUntilNextEscalation: number }): TaxScheduler {
    const scheduler = new TaxScheduler(data.tier);
    scheduler.timeUntilNextEscalationMs = data.msUntilNextEscalation;
    return scheduler;
  }
}
