import { describe, it, expect } from "vitest";
import { SaveValidator } from "../../../src/engine/persistence/SaveValidator";
import { SaveManager, type SaveState } from "../../../src/engine/persistence/SaveManager";

describe("Phase 1: IndexedDB Save Logic Fuzz & Crash Recovery Audit", () => {
  const baselineSave: SaveState = {
    version: 1,
    slot: 0,
    savedAt: Date.now(),
    planetId: "luna_prime",
    playTimeSeconds: 600,
    credits: 10000,
    taxTier: 2,
    researchData: 25,
    grid: [
      {
        qx: 0,
        qy: 0,
        type: "titanium_foundation",
        health: 100,
        is_active: true,
        metadata: {},
      },
      {
        qx: 0,
        qy: -1,
        type: "fission_reactor",
        health: 90,
        is_active: true,
        metadata: {},
      },
    ],
    unlockedTechNodes: ["improved_struts", "fuel_efficiency", "data_compression"],
    campaignProgress: {
      completedPlanetIds: ["luna_prime"],
      anchorProjectActive: false,
    },
    contracts: {
      first_touchdown: { currentProgress: 1, isCompleted: true },
    },
  };

  it("resiliently handles 100+ fuzzed mutations of serialized save states without crashing", () => {
    const jsonStr = JSON.stringify(baselineSave);
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    };
    const rand = rng(42);

    for (let iteration = 0; iteration < 100; iteration++) {
      let corrupted = jsonStr;
      const mutationType = Math.floor(rand() * 4);

      if (mutationType === 0) {
        // Truncate at random position
        const cutIndex = Math.max(1, Math.floor(rand() * jsonStr.length));
        corrupted = jsonStr.substring(0, cutIndex);
      } else if (mutationType === 1) {
        // Random character corruption
        const chars = corrupted.split("");
        const numMutations = 1 + Math.floor(rand() * 5);
        for (let m = 0; m < numMutations; m++) {
          const idx = Math.floor(rand() * chars.length);
          chars[idx] = String.fromCharCode(Math.floor(rand() * 128));
        }
        corrupted = chars.join("");
      } else if (mutationType === 2) {
        // Injection of invalid control characters / null bytes
        const idx = Math.floor(rand() * corrupted.length);
        corrupted =
          corrupted.slice(0, idx) + '\u0000\u001f{"__proto__": null}' + corrupted.slice(idx);
      } else {
        // Extreme values injection
        corrupted = jsonStr.replace('"credits":10000', '"credits":-999999999');
        corrupted = corrupted.replace('"titanium_foundation"', '"corrupted_alien_artifact_999"');
      }

      // Safe parse with fallback must NEVER throw an unhandled error
      let resultState: SaveState | null = null;
      expect(() => {
        resultState = SaveValidator.safeParseWithFallback(corrupted, 0);
      }).not.toThrow();

      const state = resultState as SaveState | null;
      expect(state).not.toBeNull();
      expect(state?.slot).toBe(0);
      expect(state?.credits).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(state?.grid)).toBe(true);
      expect(Array.isArray(state?.unlockedTechNodes)).toBe(true);
    }
  });

  it("recovers gracefully from simulated crash/abort mid-save without corrupting baseline state", async () => {
    const manager = new SaveManager();

    // 1. Establish verified initial state
    await manager.save(1, baselineSave);
    const initial = await manager.load(1);
    expect(initial?.credits).toBe(10000);
    expect(initial?.unlockedTechNodes).toHaveLength(3);

    // 2. Simulate abrupt crash mid-save by saving baseline snapshot first
    await manager.snapshotBaselineBeforeDrop(1, baselineSave);

    // Simulate corrupted partial write in another slot or failed operation
    const corruptPayload = {
      ...baselineSave,
      credits: -5000, // illegal negative value
      grid: "corrupted_non_array" as unknown as typeof baselineSave.grid,
    };

    // SaveManager rejects invalid save state
    await expect(manager.save(1, corruptPayload)).rejects.toThrow();

    // 3. Verify that the previous intact baseline remains preserved in storage
    const recovered = await manager.load(1);
    expect(recovered).not.toBeNull();
    expect(recovered?.credits).toBe(10000);
    expect(recovered?.unlockedTechNodes).toEqual([
      "improved_struts",
      "fuel_efficiency",
      "data_compression",
    ]);
    expect(recovered?.grid).toHaveLength(2);

    manager.close();
  });
});
