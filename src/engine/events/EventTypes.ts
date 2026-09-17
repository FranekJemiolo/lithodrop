/**
 * EventTypes — Exhaustive typed map of all LithoDrop game events.
 *
 * This is the single source of truth for inter-system communication.
 * Every event payload is fully typed to prevent runtime errors.
 */

import type { ModuleType } from "../grid/types";

export type GamePhase =
  "title" | "tutorial" | "campaign" | "descend" | "build" | "gameover" | "victory";

export interface TouchdownPayload {
  /** Impact velocity in m/s (downward) */
  velocity: number;
  /** Module type that just landed */
  moduleType: ModuleType;
  /** Fuel remaining as percentage [0–1] */
  fuelRemaining: number;
  /** Whether module survived the landing */
  survived: boolean;
  /** Damage percentage [0–1] inflicted by impact */
  impactDamage: number;
}

export interface HullDegradationPayload {
  instanceId: string;
  moduleType: ModuleType;
  /** Damage amount this tick */
  damage: number;
  /** Resulting health [0–100] */
  health: number;
  /** Severity score for priority queue [0–10] */
  severity: number;
  source: "acid" | "meteor" | "heat" | "impact" | "structural";
}

export interface GridSeveredPayload {
  /** Instance IDs of orphaned modules (no longer reachable from hub) */
  orphanedModules: string[];
}

export interface ModuleDestroyedPayload {
  instanceId: string;
  moduleType: ModuleType;
  qx: number;
  qy: number;
}

export interface ModuleSnappedPayload {
  instanceId: string;
  moduleType: ModuleType;
  qx: number;
  qy: number;
}

export interface DroneDispatchedPayload {
  droneId: string;
  droneClass: "rigger" | "welder" | "courier";
  targetInstanceId: string;
}

export interface TaxEscalatedPayload {
  newTier: number;
  taxRatePerSecond: number;
}

export interface EconomyTickPayload {
  credits: number;
  creditsPerSecond: number;
  taxPerSecond: number;
  netPerSecond: number;
  upkeepDeficit: boolean;
}

export interface PhaseChangedPayload {
  from: GamePhase;
  to: GamePhase;
}

export interface QuotaMetPayload {
  creditsPerSecond: number;
  requiredCreditsPerSecond: number;
}

export interface OverclockActivatedPayload {
  nodeId: string;
  durationMs: number;
}

export interface HazardSpawnedPayload {
  hazardType: string;
  severity: number;
  affectedArea: { x: number; y: number; radius: number };
}

export interface ContractCompletedPayload {
  contractId: string;
  title: string;
  rewardCredits: number;
  rewardData: number;
}

/** Exhaustive map of all game events → their payload types */
export interface GameEventMap {
  PAYLOAD_TOUCHDOWN: TouchdownPayload;
  HULL_DEGRADATION: HullDegradationPayload;
  GRID_SEVERED: GridSeveredPayload;
  MODULE_DESTROYED: ModuleDestroyedPayload;
  MODULE_SNAPPED: ModuleSnappedPayload;
  DRONE_DISPATCHED: DroneDispatchedPayload;
  TAX_ESCALATED: TaxEscalatedPayload;
  ECONOMY_TICK: EconomyTickPayload;
  PHASE_CHANGED: PhaseChangedPayload;
  QUOTA_MET: QuotaMetPayload;
  BANKRUPTCY: Record<string, never>;
  ANCHOR_AUTHORIZED: Record<string, never>;
  VICTORY: Record<string, never>;
  OVERCLOCK_ACTIVATED: OverclockActivatedPayload;
  HAZARD_SPAWNED: HazardSpawnedPayload;
  AUDIO_CONTEXT_UNLOCKED: Record<string, never>;
  CONTRACT_COMPLETED: ContractCompletedPayload;
  PLANET_UNLOCKED: { planetId: string };
}
