/**
 * SaveManager — IndexedDB persistence for LithoDrop save slots.
 *
 * Schema: a single object store "saves" keyed by slot ID (0–2).
 * Each value is a SaveState document validated by SaveValidator.
 *
 * Features:
 *   1. Atomic save/load with schema validation against corrupted/manipulated saves.
 *   2. Mid-drop crash protection: snapshots baseline colony state before descent
 *      so that closing the browser mid-drop leaves the baseline grid intact.
 *   3. Safe fallback in case of database unavailability or corruption.
 */

import type { ModuleType } from "../grid/types";
import { SaveValidator } from "./SaveValidator";

const DB_NAME = "lithodrop";
const DB_VERSION = 1;
const STORE_NAME = "saves";

export type SaveSlot = 0 | 1 | 2;

export interface SaveState {
  version: number;
  slot: SaveSlot;
  savedAt: number; // Date.now()
  planetId: string;
  playTimeSeconds: number;
  credits: number;
  taxTier: number;
  researchData?: number;
  grid: Array<{
    qx: number;
    qy: number;
    type: ModuleType;
    health: number;
    is_active: boolean;
    metadata: Record<string, number | string | boolean>;
  }>;
  unlockedTechNodes: string[];
  campaignProgress: {
    completedPlanetIds: string[];
    anchorProjectActive: boolean;
  };
  contracts?: Record<
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
  >;
}

export class SaveManager {
  private db: IDBDatabase | null = null;
  /** In-memory cache & fallback if IndexedDB is unavailable or for rapid lookup */
  private memoryFallback = new Map<SaveSlot, SaveState>();
  /** Baseline grid snapshot for mid-drop crash protection */
  private baselineSnapshots = new Map<SaveSlot, SaveState>();

  async open(): Promise<void> {
    if (this.db) return;
    if (typeof indexedDB === "undefined") {
      return; // fallback to in-memory store
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "slot" });
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          resolve();
        };

        request.onerror = () => {
          console.warn("SaveManager: Failed to open IndexedDB, falling back to memory store.");
          resolve();
        };
      } catch (err) {
        console.warn("SaveManager: IndexedDB exception, falling back to memory store:", err);
        resolve();
      }
    });
  }

  /**
   * Snapshot baseline colony state before initiating a descent drop.
   * Ensures that closing or refreshing the browser mid-drop does not corrupt the baseline grid.
   */
  async snapshotBaselineBeforeDrop(
    slot: SaveSlot,
    state: Omit<SaveState, "slot" | "savedAt">,
  ): Promise<void> {
    const fullState: SaveState = {
      ...state,
      slot,
      savedAt: Date.now(),
      version: 1,
    };
    this.baselineSnapshots.set(slot, JSON.parse(JSON.stringify(fullState)));
    // Also persist baseline state directly to storage
    await this.save(slot, state);
  }

  /**
   * Get the baseline snapshot taken before the drop started.
   */
  getBaselineSnapshot(slot: SaveSlot): SaveState | null {
    return this.baselineSnapshots.get(slot) ?? null;
  }

  /**
   * Save game state to storage. Validates payload before writing.
   */
  async save(slot: SaveSlot, state: Omit<SaveState, "slot" | "savedAt">): Promise<void> {
    const fullState: SaveState = {
      ...state,
      slot,
      savedAt: Date.now(),
      version: 1,
    };

    // Pre-validate
    const validation = SaveValidator.validate(fullState);
    if (!validation.valid) {
      console.error("SaveManager: Refusing to save invalid state:", validation.errors);
      throw new Error(`SaveManager: Invalid save state — ${validation.errors.join("; ")}`);
    }

    this.memoryFallback.set(slot, fullState);

    await this.open();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fullState);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Load and validate game state from storage.
   * If save is corrupted or manipulated, rejects it safely without crashing.
   */
  async load(slot: SaveSlot): Promise<SaveState | null> {
    await this.open();

    let rawState: unknown = null;

    if (this.db) {
      rawState = await new Promise((resolve) => {
        const tx = this.db!.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(slot);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    }

    if (!rawState) {
      rawState = this.memoryFallback.get(slot) ?? null;
    }

    if (!rawState) return null;

    // Validate using SaveValidator
    const validation = SaveValidator.validate(rawState);
    if (!validation.valid) {
      console.warn(`SaveManager: Corrupted save detected in slot ${slot}:`, validation.errors);
      // Return safe fallback rather than crashing
      return SaveValidator.createDefault(slot);
    }

    return validation.state;
  }

  async delete(slot: SaveSlot): Promise<void> {
    this.memoryFallback.delete(slot);
    this.baselineSnapshots.delete(slot);

    await this.open();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(slot);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async listSlots(): Promise<
    Array<Pick<SaveState, "slot" | "savedAt" | "planetId" | "credits" | "playTimeSeconds"> | null>
  > {
    await this.open();

    const slots: Array<Pick<
      SaveState,
      "slot" | "savedAt" | "planetId" | "credits" | "playTimeSeconds"
    > | null> = [null, null, null];

    // Read from memory cache first
    for (const [slot, state] of this.memoryFallback.entries()) {
      slots[slot] = {
        slot: state.slot,
        savedAt: state.savedAt,
        planetId: state.planetId,
        credits: state.credits,
        playTimeSeconds: state.playTimeSeconds,
      };
    }

    if (!this.db) return slots;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const saves = req.result as SaveState[];
        for (const save of saves) {
          const val = SaveValidator.validate(save);
          if (val.valid && val.state) {
            slots[save.slot] = {
              slot: save.slot,
              savedAt: save.savedAt,
              planetId: save.planetId,
              credits: save.credits,
              playTimeSeconds: save.playTimeSeconds,
            };
          }
        }
        resolve(slots);
      };
      req.onerror = () => resolve(slots);
    });
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.memoryFallback.clear();
    this.baselineSnapshots.clear();
  }
}

export const saveManager = new SaveManager();
