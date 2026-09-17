import { describe, it, expect } from "vitest";
import { SaveValidator } from "../../../src/engine/persistence/SaveValidator";
import { SaveManager, type SaveState } from "../../../src/engine/persistence/SaveManager";

describe("Milestone 9: Save Validation & Schema Integrity", () => {
  const validSave: SaveState = {
    version: 1,
    slot: 0,
    savedAt: 1700000000000,
    planetId: "luna_prime",
    playTimeSeconds: 320,
    credits: 5400,
    taxTier: 1,
    researchData: 12,
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
        type: "solar_array",
        health: 85,
        is_active: true,
        metadata: {},
      },
    ],
    unlockedTechNodes: ["dual_engine", "rcs_efficiency"],
    campaignProgress: {
      completedPlanetIds: ["luna_prime"],
      anchorProjectActive: false,
    },
    contracts: {
      first_touchdown: { currentProgress: 1, isCompleted: true },
    },
  };

  it("validates a compliant SaveState successfully", () => {
    const res = SaveValidator.validate(validSave);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.state).not.toBeNull();
    expect(res.state?.credits).toBe(5400);
    expect(res.state?.grid).toHaveLength(2);
  });

  it("safely rejects non-object or malformed JSON payloads without crashing", () => {
    expect(SaveValidator.validate(null).valid).toBe(false);
    expect(SaveValidator.validate(undefined).valid).toBe(false);
    expect(SaveValidator.validate("not an object").valid).toBe(false);
    expect(SaveValidator.validate([]).valid).toBe(false);

    // Corrupted raw JSON syntax
    const jsonRes = SaveValidator.parseAndValidate("{ corrupted_json: [1, 2,");
    expect(jsonRes.valid).toBe(false);
    expect(jsonRes.state).toBeNull();
    expect(jsonRes.errors[0]).toContain("JSON parse error");
  });

  it("rejects negative or non-finite economy values (credits, taxTier, researchData)", () => {
    const corruptCredits = { ...validSave, credits: -500 };
    expect(SaveValidator.validate(corruptCredits).valid).toBe(false);

    const nanCredits = { ...validSave, credits: NaN };
    expect(SaveValidator.validate(nanCredits).valid).toBe(false);

    const negativeResearch = { ...validSave, researchData: -10 };
    expect(SaveValidator.validate(negativeResearch).valid).toBe(false);
  });

  it("rejects invalid or corrupted grid module definitions", () => {
    // Unknown module type
    const unknownModule = {
      ...validSave,
      grid: [
        {
          qx: 0,
          qy: 0,
          type: "illegal_alien_blaster",
          health: 100,
          is_active: true,
          metadata: {},
        },
      ],
    };
    const resUnknown = SaveValidator.validate(unknownModule);
    expect(resUnknown.valid).toBe(false);
    expect(resUnknown.errors.some((e) => e.includes("unknown type"))).toBe(true);

    // Out-of-bounds health
    const badHealth = {
      ...validSave,
      grid: [
        {
          qx: 0,
          qy: 0,
          type: "titanium_foundation",
          health: 250, // Max 100
          is_active: true,
          metadata: {},
        },
      ],
    };
    expect(SaveValidator.validate(badHealth).valid).toBe(false);

    // Non-numeric coordinate
    const badCoords = {
      ...validSave,
      grid: [
        {
          qx: "north" as unknown as number,
          qy: 0,
          type: "titanium_foundation",
          health: 100,
          is_active: true,
          metadata: {},
        },
      ],
    };
    expect(SaveValidator.validate(badCoords).valid).toBe(false);
  });

  it("provides clean fallback state on corrupted save instead of crashing", () => {
    const fallback = SaveValidator.safeParseWithFallback({ corrupt: true }, 1);
    expect(fallback.slot).toBe(1);
    expect(fallback.credits).toBe(2000);
    expect(fallback.grid).toHaveLength(1);
    expect(fallback.grid[0].type).toBe("titanium_foundation");
  });

  it("bug check: closing browser mid-drop does not corrupt baseline grid state", async () => {
    const manager = new SaveManager();

    // Colony baseline established before drop
    const baselineColony: Omit<SaveState, "slot" | "savedAt"> = {
      version: 1,
      planetId: "luna_prime",
      playTimeSeconds: 150,
      credits: 3000,
      taxTier: 0,
      researchData: 5,
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
          qx: 1,
          qy: 0,
          type: "fission_reactor",
          health: 100,
          is_active: true,
          metadata: {},
        },
      ],
      unlockedTechNodes: ["dual_engine"],
      campaignProgress: {
        completedPlanetIds: [],
        anchorProjectActive: false,
      },
    };

    // Snapshot baseline before drop
    await manager.snapshotBaselineBeforeDrop(0, baselineColony);

    // Simulate mid-drop crash / abrupt browser close without completing descent
    // Notice no new save was committed to slot 0

    // Next browser session reload
    const restored = await manager.load(0);
    expect(restored).not.toBeNull();
    expect(restored?.grid).toHaveLength(2);
    expect(restored?.grid[0].type).toBe("titanium_foundation");
    expect(restored?.grid[1].type).toBe("fission_reactor");
    expect(restored?.credits).toBe(3000);
    expect(restored?.unlockedTechNodes).toEqual(["dual_engine"]);

    manager.close();
  });
});
