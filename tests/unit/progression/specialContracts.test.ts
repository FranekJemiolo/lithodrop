/**
 * SpecialContracts unit tests — tracking events, progress advancement, rewards emission.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SpecialContractsManager } from "../../../src/engine/progression/SpecialContracts";
import { eventBus } from "../../../src/engine/events/EventBus";

describe("SpecialContractsManager", () => {
  let manager: SpecialContractsManager;

  beforeEach(() => {
    eventBus.clearAll();
    manager = new SpecialContractsManager();
  });

  it("initializes with default syndicate directives", () => {
    const contracts = manager.getContracts();
    expect(contracts.length).toBe(6);
    expect(contracts.some((c) => c.id === "first_touchdown")).toBe(true);
    expect(contracts.some((c) => c.id === "featherfall")).toBe(true);
    expect(contracts.some((c) => c.id === "power_grid_mesh")).toBe(true);
    expect(manager.getActiveContracts().length).toBe(6);
    expect(manager.getCompletedContracts().length).toBe(0);
  });

  it("advances progress and completes contract upon reaching target", () => {
    let completedEventPayload: any = null;
    eventBus.on("CONTRACT_COMPLETED", (ev) => {
      completedEventPayload = ev;
    });

    manager.advanceProgress("first_touchdown", 1);

    const c = manager.getContract("first_touchdown");
    expect(c?.isCompleted).toBe(true);
    expect(c?.currentProgress).toBe(1);
    expect(completedEventPayload).not.toBeNull();
    expect(completedEventPayload.contractId).toBe("first_touchdown");
    expect(completedEventPayload.rewardCredits).toBe(500);
    expect(completedEventPayload.rewardData).toBe(2);
  });

  it("responds to EventBus PAYLOAD_TOUCHDOWN event", () => {
    eventBus.emit("PAYLOAD_TOUCHDOWN", {
      velocity: 3.2,
      moduleType: "titanium_foundation",
      fuelRemaining: 0.5,
      survived: true,
      impactDamage: 0,
    });

    const touchdownContract = manager.getContract("first_touchdown");
    const featherfallContract = manager.getContract("featherfall");

    expect(touchdownContract?.isCompleted).toBe(true);
    expect(featherfallContract?.isCompleted).toBe(true);
  });

  it("serializes and deserializes contract state correctly", () => {
    manager.advanceProgress("power_grid_mesh", 2);
    const serialized = manager.serialize();

    expect(serialized["power_grid_mesh"].currentProgress).toBe(2);
    expect(serialized["power_grid_mesh"].isCompleted).toBe(false);

    const newManager = new SpecialContractsManager();
    newManager.deserialize(serialized);

    const restored = newManager.getContract("power_grid_mesh");
    expect(restored?.currentProgress).toBe(2);
    expect(restored?.isCompleted).toBe(false);
  });
});
