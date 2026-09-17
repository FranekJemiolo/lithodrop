/**
 * SaveManager — IndexedDB persistence for LithoDrop save slots.
 *
 * Schema: a single object store "saves" keyed by slot ID (0–2).
 * Each value is a SaveState document matching docs/api/save-schema.md.
 *
 * API surface:
 *   await save.save(slot, state)   — write a save
 *   await save.load(slot)          — read a save (null if empty)
 *   await save.delete(slot)        — delete a save
 *   await save.listSlots()         — list all save slot metadata
 */

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
  grid: Array<{
    qx: number;
    qy: number;
    type: string;
    health: number;
    is_active: boolean;
    metadata: Record<string, number | string | boolean>;
  }>;
  unlockedTechNodes: string[];
  campaignProgress: {
    completedPlanetIds: string[];
    anchorProjectActive: boolean;
  };
}

export class SaveManager {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
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

      request.onerror = () => reject(request.error);
    });
  }

  async save(slot: SaveSlot, state: Omit<SaveState, "slot" | "savedAt">): Promise<void> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const fullState: SaveState = {
        ...state,
        slot,
        savedAt: Date.now(),
        version: 1,
      };
      const req = store.put(fullState);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async load(slot: SaveSlot): Promise<SaveState | null> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(slot);
      req.onsuccess = () => resolve((req.result as SaveState) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(slot: SaveSlot): Promise<void> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(slot);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async listSlots(): Promise<Array<Pick<SaveState, "slot" | "savedAt" | "planetId" | "credits" | "playTimeSeconds"> | null>> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const saves = req.result as SaveState[];
        const slots: Array<Pick<SaveState, "slot" | "savedAt" | "planetId" | "credits" | "playTimeSeconds"> | null> = [null, null, null];
        for (const save of saves) {
          slots[save.slot] = {
            slot: save.slot,
            savedAt: save.savedAt,
            planetId: save.planetId,
            credits: save.credits,
            playTimeSeconds: save.playTimeSeconds,
          };
        }
        resolve(slots);
      };
      req.onerror = () => reject(req.error);
    });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}

export const saveManager = new SaveManager();
