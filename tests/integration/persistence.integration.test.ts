import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GridState } from "../../src/engine/grid/GridState";
import { TechTree } from "../../src/engine/progression/TechTree";
import { SaveManager } from "../../src/engine/persistence/SaveManager";
import { SpecialContractsManager } from "../../src/engine/progression/SpecialContracts";

describe("Milestone 9 Integration: Hard Browser Refresh Persistence Round-Trip", () => {
  let saveManager: SaveManager;

  beforeEach(() => {
    saveManager = new SaveManager();
  });

  afterEach(() => {
    saveManager.close();
  });

  it("restores base grid, tech tree unlocks, and economy exactly as left after simulated hard refresh", async () => {
    // 1. Initial Session: build a multi-module base and research tech nodes
    const session1Grid = new GridState();
    session1Grid.placeModule({ qx: 0, qy: 0 }, "titanium_foundation");
    session1Grid.placeModule({ qx: 0, qy: -1 }, "solar_array");
    session1Grid.placeModule({ qx: 1, qy: 0 }, "fission_reactor");
    session1Grid.placeModule({ qx: -1, qy: 0 }, "science_lab");

    // Damage one module slightly to test health persistence
    const solar = session1Grid.getModule({ qx: 0, qy: -1 })!;
    session1Grid.updateModule(solar.instanceId, { health: 75 });

    const session1Tech = new TechTree();
    let researchData = 20;
    const unlock1 = session1Tech.unlock("improved_struts", researchData);
    expect(unlock1.success).toBe(true);
    researchData -= unlock1.cost;

    const unlock2 = session1Tech.unlock("fuel_efficiency", researchData);
    expect(unlock2.success).toBe(true);
    researchData -= unlock2.cost;

    const credits = 4850;
    const taxTier = 2;

    const contracts = new SpecialContractsManager();
    contracts.advanceProgress("first_touchdown", 1);

    // 2. Persist state to save slot 0
    await saveManager.save(0, {
      version: 1,
      planetId: "luna_prime",
      playTimeSeconds: 420,
      credits,
      taxTier,
      researchData,
      grid: session1Grid.toJSON(),
      unlockedTechNodes: session1Tech.getUnlockedNodeIds(),
      campaignProgress: {
        completedPlanetIds: ["luna_prime"],
        anchorProjectActive: false,
      },
      contracts: contracts.serialize(),
    });

    // 3. Simulate Hard Browser Refresh:
    // Discard all session 1 memory instances completely
    const session2Grid = new GridState();
    const session2Tech = new TechTree();
    const session2Contracts = new SpecialContractsManager();

    // Verify session 2 is currently empty / fresh default
    expect(session2Grid.size).toBe(0);
    expect(session2Tech.getUnlockedNodeIds()).toHaveLength(0);

    // 4. Load persisted save from storage
    const loadedState = await saveManager.load(0);
    expect(loadedState).not.toBeNull();

    // 5. Restore session 2 components from loadedState
    session2Grid.fromJSON(loadedState!.grid);
    session2Tech.restoreUnlockedNodes(loadedState!.unlockedTechNodes);
    if (loadedState!.contracts) {
      session2Contracts.deserialize(loadedState!.contracts);
    }

    // 6. Verify exact state restoration
    expect(session2Grid.size).toBe(4);
    expect(session2Grid.getModule({ qx: 0, qy: 0 })?.type).toBe("titanium_foundation");
    expect(session2Grid.getModule({ qx: 0, qy: -1 })?.type).toBe("solar_array");
    expect(session2Grid.getModule({ qx: 0, qy: -1 })?.health).toBe(75);
    expect(session2Grid.getModule({ qx: 1, qy: 0 })?.type).toBe("fission_reactor");
    expect(session2Grid.getModule({ qx: -1, qy: 0 })?.type).toBe("science_lab");

    // Tech tree unlocks
    expect(session2Tech.isUnlocked("improved_struts")).toBe(true);
    expect(session2Tech.isUnlocked("fuel_efficiency")).toBe(true);
    expect(session2Tech.isUnlocked("advanced_alloys")).toBe(false);

    // Economy & Meta-progression
    expect(loadedState!.credits).toBe(4850);
    expect(loadedState!.taxTier).toBe(2);
    expect(loadedState!.researchData).toBe(researchData);

    // Contracts
    expect(session2Contracts.getContract("first_touchdown")?.isCompleted).toBe(true);
  });
});
