import { describe, it, expect, beforeEach } from "vitest";
import { SpecialContractsManager } from "../../../src/engine/progression/SpecialContracts";
import { TelemetryTracker } from "../../../src/engine/physics/TelemetryTracker";
import { eventBus } from "../../../src/engine/events/EventBus";
import type { VIPContractFailedPayload } from "../../../src/engine/events/EventTypes";
import type Matter from "matter-js";

describe("Milestone 8: VIP Contracts & Telemetry Tracking", () => {
  let contractsManager: SpecialContractsManager;
  let telemetryTracker: TelemetryTracker;

  beforeEach(() => {
    eventBus.clearAll();
    contractsManager = new SpecialContractsManager();
    telemetryTracker = new TelemetryTracker();
  });

  it("dynamically generates VIP contracts with strict G-force and tilt limits", () => {
    const vip1 = contractsManager.generateVipContract();
    expect(vip1.isVip).toBe(true);
    expect(vip1.maxGForce).toBeGreaterThan(0);
    expect(vip1.maxTiltDeg).toBeGreaterThan(0);
    expect(vip1.isFailed).toBe(false);
    expect(vip1.isCompleted).toBe(false);

    // Custom VIP contract
    const customVip = contractsManager.generateVipContract({
      id: "vip_quantum_transport",
      title: "VIP: Quantum Core Delivery",
      maxGForce: 2.2,
      maxTiltDeg: 15,
      rewardCredits: 7000,
      rewardData: 20,
    });
    expect(customVip.id).toBe("vip_quantum_transport");
    expect(customVip.maxGForce).toBe(2.2);
    expect(customVip.maxTiltDeg).toBe(15);
    expect(customVip.rewardCredits).toBe(7000);
  });

  it("monitors telemetry and immediately fails VIP contract if G-force limit is breached", () => {
    const vip = contractsManager.generateVipContract({
      id: "vip_fragile_cargo",
      maxGForce: 2.5,
      maxTiltDeg: 30,
    });
    contractsManager.setActiveVipContract(vip);

    let failedEvent: VIPContractFailedPayload | null = null;
    eventBus.on("VIP_CONTRACT_FAILED", (ev) => {
      failedEvent = ev;
    });

    // Mock Matter.js body
    const mockBody = {
      velocity: { x: 0, y: 0 },
      angle: 0,
    } as unknown as Matter.Body;

    // Initial frame tick (dt = 0.02s)
    telemetryTracker.update(mockBody, 0.02, vip);
    expect(vip.isFailed).toBe(false);

    // Frame 2: sudden massive acceleration spike
    // dv = 60 px in 0.02s => 3000 px/s² => 1500 m/s² => ~152 Gs
    mockBody.velocity.x = 0;
    mockBody.velocity.y = 60;
    const telemetry = telemetryTracker.update(mockBody, 0.02, vip);

    expect(telemetry.isVipBreached).toBe(true);
    expect(vip.isFailed).toBe(true);
    expect(vip.failureReason).toContain("G-force limit exceeded");
    expect(failedEvent).not.toBeNull();
    expect((failedEvent as VIPContractFailedPayload | null)?.contractId).toBe("vip_fragile_cargo");
  });

  it("monitors telemetry and immediately fails VIP contract if tilt limit is breached", () => {
    const vip = contractsManager.generateVipContract({
      id: "vip_dignitary",
      maxGForce: 5.0,
      maxTiltDeg: 20,
    });
    contractsManager.setActiveVipContract(vip);

    let failedEvent: VIPContractFailedPayload | null = null;
    eventBus.on("VIP_CONTRACT_FAILED", (ev) => {
      failedEvent = ev;
    });

    const mockBody = {
      velocity: { x: 0, y: 0 },
      angle: 0, // upright
    } as unknown as Matter.Body;

    // Frame 1: upright
    telemetryTracker.update(mockBody, 0.02, vip);
    expect(vip.isFailed).toBe(false);

    // Frame 2: excessive tilt (30 degrees = ~0.523 rad)
    mockBody.angle = 0.5236; // ~30 deg
    const telemetry = telemetryTracker.update(mockBody, 0.02, vip);

    expect(telemetry.isVipBreached).toBe(true);
    expect(vip.isFailed).toBe(true);
    expect(vip.failureReason).toContain("Tilt limit exceeded");
    expect((failedEvent as VIPContractFailedPayload | null)?.contractId).toBe("vip_dignitary");
  });

  it("successfully completes VIP contract on survived touchdown if limits were not breached", () => {
    const vip = contractsManager.generateVipContract({
      id: "vip_successful_drop",
      maxGForce: 3.0,
      maxTiltDeg: 25,
      rewardCredits: 5000,
    });
    contractsManager.setActiveVipContract(vip);

    let completedContractId = "";
    eventBus.on("CONTRACT_COMPLETED", (ev) => {
      completedContractId = ev.contractId;
    });

    // Simulate smooth descent within limits
    const mockBody = {
      velocity: { x: 0, y: 5 },
      angle: 0.05, // ~2.8 degrees
    } as unknown as Matter.Body;

    telemetryTracker.update(mockBody, 0.02, vip);
    telemetryTracker.update(mockBody, 0.02, vip);

    expect(vip.isFailed).toBe(false);

    // Simulate safe touchdown event
    eventBus.emit("PAYLOAD_TOUCHDOWN", {
      velocity: 3.0,
      moduleType: "crew_habitat",
      fuelRemaining: 0.5,
      survived: true,
      impactDamage: 0,
    });

    expect(vip.isCompleted).toBe(true);
    expect(completedContractId).toBe("vip_successful_drop");
  });

  it("does not complete VIP contract on touchdown if it was previously breached", () => {
    const vip = contractsManager.generateVipContract({
      id: "vip_already_failed",
      maxGForce: 2.0,
      maxTiltDeg: 15,
    });
    contractsManager.setActiveVipContract(vip);

    // Breach VIP contract
    contractsManager.failVipContract(vip.id, "Violated flight envelope");
    expect(vip.isFailed).toBe(true);

    let completed = false;
    eventBus.on("CONTRACT_COMPLETED", (ev) => {
      if (ev.contractId === vip.id) completed = true;
    });

    // Touchdown occurs
    eventBus.emit("PAYLOAD_TOUCHDOWN", {
      velocity: 2.0,
      moduleType: "crew_habitat",
      fuelRemaining: 0.8,
      survived: true,
      impactDamage: 0,
    });

    expect(vip.isCompleted).toBe(false);
    expect(completed).toBe(false);
  });
});
