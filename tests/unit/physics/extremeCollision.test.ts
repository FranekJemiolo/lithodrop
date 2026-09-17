import { describe, it, expect, beforeEach } from "vitest";
import Matter from "matter-js";
import { PhysicsWorld } from "../../../src/engine/physics/PhysicsWorld";
import { createLanderBody } from "../../../src/engine/physics/LanderBody";
import { createTerrainBodies } from "../../../src/engine/physics/TerrainBody";
import { DescendPhaseSystem } from "../../../src/engine/systems/DescendPhaseSystem";
import { InputSystem } from "../../../src/engine/systems/InputSystem";
import { eventBus } from "../../../src/engine/events/EventBus";
import { BuildPhaseSystem } from "../../../src/engine/systems/BuildPhaseSystem";
import { PLANETS } from "../../../src/constants/planets";
import type { TouchdownPayload } from "../../../src/engine/events/EventTypes";

describe("Phase 1: Extreme Physics Collisions & Boundary Integrity", () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  it("forces extreme velocity drop of heavy Fission Reactor: shatters completely without clipping past bedrock", () => {
    const surfaceY = 500;
    const world = new PhysicsWorld(24.8); // Zephyrus extreme gravity

    // Create terrain with bedrock
    const terrain = createTerrainBodies({
      width: 1000,
      surfaceY,
      seed: 12345,
      roughness: 0.1,
      hasCanyonWalls: false,
    });
    for (const b of terrain.bodies) {
      world.addBody(b);
    }

    // Heavy Fission Reactor (12,000 kg)
    const lander = createLanderBody({
      moduleType: "fission_reactor",
      startX: 500,
      startY: surfaceY - 60,
    });
    world.addBody(lander.body);

    // Set catastrophic downward velocity (120 m/s equivalent)
    Matter.Body.setVelocity(lander.body, { x: 0, y: 80 });

    const mockCanvas = document.createElement("canvas");
    const input = new InputSystem(mockCanvas);
    const descendSystem = new DescendPhaseSystem(
      world,
      input,
      lander,
      "zephyrus",
      undefined,
      surfaceY,
    );

    let touchdownEvent: TouchdownPayload | null = null;
    eventBus.on("PAYLOAD_TOUCHDOWN", (ev) => {
      touchdownEvent = ev;
    });

    // Step physics loop
    for (let step = 0; step < 10; step++) {
      descendSystem.update({ deltaMS: 20 } as unknown as import("pixi.js").Ticker);
    }

    const ev = touchdownEvent as TouchdownPayload | null;
    expect(ev).not.toBeNull();
    expect(ev?.survived).toBe(false);
    expect(ev?.impactDamage).toBeGreaterThanOrEqual(100);

    const finalState = descendSystem.getLanderState();
    expect(finalState.isAlive).toBe(false);
    expect(finalState.hullHealth).toBe(0);

    // Verify no tunneling: velocity clamped and position held above/at surface level
    expect(finalState.body.velocity.y).toBe(0);
    expect(finalState.body.position.y).toBeLessThanOrEqual(surfaceY + 25);

    world.destroy();
    input.destroy();
    descendSystem.destroy();
  });

  it("ensures destroyed / shattered payloads are NEVER added to the colony grid", () => {
    const planet = PLANETS[0];
    const buildSystem = new BuildPhaseSystem(planet);

    // Initial grid has only the anchor foundation at (0, 0)
    expect(buildSystem.grid.size).toBe(1);

    // Simulate catastrophic crash of a heavy reactor
    eventBus.emit("PAYLOAD_TOUCHDOWN", {
      velocity: 85,
      moduleType: "fission_reactor",
      fuelRemaining: 0,
      survived: false,
      impactDamage: 100,
    });

    // Grid must remain at size 1 with no overlapping/orphaned shattered modules
    expect(buildSystem.grid.size).toBe(1);
    expect(buildSystem.grid.getModule({ qx: 0, qy: 0 })?.type).toBe("titanium_foundation");
    expect(
      buildSystem.grid.getAllModules().filter((m) => m.type === "fission_reactor"),
    ).toHaveLength(0);

    buildSystem.destroy();
  });

  it("triggers anti-tunneling safeguard when discrete collision step overshoots surface", () => {
    const surfaceY = 400;
    const world = new PhysicsWorld(1.62);

    const lander = createLanderBody({
      moduleType: "titanium_foundation",
      startX: 400,
      startY: surfaceY + 30, // Positioned past surface
    });
    world.addBody(lander.body);

    const mockCanvas = document.createElement("canvas");
    const input = new InputSystem(mockCanvas);
    const descendSystem = new DescendPhaseSystem(
      world,
      input,
      lander,
      "luna_prime",
      undefined,
      surfaceY,
    );

    let triggered = false;
    eventBus.on("PAYLOAD_TOUCHDOWN", () => {
      triggered = true;
    });

    // Single frame update
    descendSystem.update({ deltaMS: 20 } as unknown as import("pixi.js").Ticker);

    expect(triggered).toBe(true);
    expect(descendSystem.getLanderState().body.position.y).toBeLessThanOrEqual(surfaceY + 15);

    world.destroy();
    input.destroy();
    descendSystem.destroy();
  });
});
