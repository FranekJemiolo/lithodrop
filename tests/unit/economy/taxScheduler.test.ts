/**
 * EconomyEngine + TaxScheduler unit tests.
 */

import { describe, it, expect, afterEach } from "vitest";
import { TaxScheduler, TAX_TIERS } from "../../../src/engine/economy/TaxScheduler";
import { eventBus } from "../../../src/engine/events/EventBus";

describe("TaxScheduler", () => {
  afterEach(() => {
    eventBus.clearAll();
  });

  it("starts at the specified tier", () => {
    const scheduler = new TaxScheduler(0);
    expect(scheduler.tier).toBe(0);
    expect(scheduler.currentTaxRate).toBe(TAX_TIERS[0]);
  });

  it("escalates after 180 seconds", () => {
    const scheduler = new TaxScheduler(0);
    // Tick 180,000ms in one call
    const escalated = scheduler.tick(180_000);
    expect(escalated).toBe(true);
    expect(scheduler.tier).toBe(1);
    expect(scheduler.currentTaxRate).toBe(TAX_TIERS[1]);
  });

  it("does not escalate before 180 seconds", () => {
    const scheduler = new TaxScheduler(0);
    const escalated = scheduler.tick(179_999);
    expect(escalated).toBe(false);
    expect(scheduler.tier).toBe(0);
  });

  it("does not escalate beyond max tier", () => {
    const scheduler = new TaxScheduler(5); // already at max
    const escalated = scheduler.tick(360_000);
    expect(escalated).toBe(false);
    expect(scheduler.tier).toBe(5);
  });

  it("emits TAX_ESCALATED event on escalation", () => {
    const scheduler = new TaxScheduler(0);
    let receivedNewTier = -1;

    eventBus.on("TAX_ESCALATED", (ev) => {
      receivedNewTier = ev.newTier;
    });

    scheduler.tick(180_000);
    expect(receivedNewTier).toBe(1);
  });

  it("serializes and deserializes correctly", () => {
    const original = new TaxScheduler(2);
    original.tick(50_000); // Advance 50s into tier 2

    const json = original.toJSON();
    const restored = TaxScheduler.fromJSON(json);

    expect(restored.tier).toBe(json.tier);
    expect(restored.msUntilNextEscalation).toBeCloseTo(json.msUntilNextEscalation, 0);
  });

  it("all tax tiers are positive and increasing", () => {
    for (let i = 1; i < TAX_TIERS.length; i++) {
      expect(TAX_TIERS[i]).toBeGreaterThan(TAX_TIERS[i - 1]);
    }
  });
});
