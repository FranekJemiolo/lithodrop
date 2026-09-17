/**
 * DroneDispatchQueue — Event-driven drone dispatch using a max-heap.
 *
 * Subscribes to HULL_DEGRADATION events from the EventBus.
 * Maintains a priority queue keyed on `severity` [0–10].
 * When a drone becomes available, the highest-severity pending
 * task is dispatched first.
 *
 * Drone classes:
 *   - Welder (severity ≥ 6): repairs structural and impact damage
 *   - Rigger (severity ≥ 4): handles acid/meteor surface damage
 *   - Courier (severity < 4): routine resupply runs
 */

import { eventBus } from "./EventBus";
import { PriorityQueue } from "./PriorityQueue";
import type { HullDegradationPayload } from "./EventTypes";

/**
 * Drone classes:
 *   - Courier (severity ≥ 8 or emergency): emergency triage, high-speed hazard stabilization
 *   - Welder  (4 ≤ severity < 8): structural and impact damage repair
 *   - Rigger   (severity < 4 or dragging): dragging unanchored payloads, debris removal
 */
export type DroneClass = "rigger" | "welder" | "courier";

export interface DispatchTask {
  instanceId: string;
  severity: number;
  source: HullDegradationPayload["source"];
  taskType?: "emergency" | "repair" | "drag";
  queuedAt: number; // Date.now()
}

export interface DroneState {
  droneId: string;
  droneClass: DroneClass;
  isBusy: boolean;
  currentTargetId: string | null;
  dispatchedAt: number | null;
  taskDurationMs: number;
  elapsedMs: number;
}

/**
 * Route drone class based on hazard severity and source:
 * - Couriers (severity ≥ 8): critical emergency triage & rapid containment
 * - Welders (severity 4–7): hull fracture welding & structural repair
 * - Riggers (severity < 4): module dragging, alignment & surface debris clearing
 */
export function classForSeverity(
  severity: number,
  source?: HullDegradationPayload["source"],
  taskType?: "emergency" | "repair" | "drag",
): DroneClass {
  if (taskType === "emergency") return "courier";
  if (taskType === "repair") return "welder";
  if (taskType === "drag") return "rigger";

  if (severity >= 8 || source === "meteor") return "courier";
  if (severity >= 4) return "welder";
  return "rigger";
}

const DRONE_DURATIONS: Record<DroneClass, number> = {
  courier: 1500, // rapid emergency response
  welder: 3000, // careful structural welding
  rigger: 2500, // mechanical dragging / clearing
};

export class DroneDispatchQueue {
  private readonly queue: PriorityQueue<DispatchTask>;
  private readonly drones: Map<string, DroneState>;
  private droneCount = 0;

  private readonly unsubHullDegradation: () => void;

  constructor(initialDroneCount = 3) {
    this.queue = new PriorityQueue<DispatchTask>((a, b) => a.severity - b.severity);
    this.drones = new Map();

    // Create initial drone fleet
    for (let i = 0; i < initialDroneCount; i++) {
      this.addDrone();
    }

    // Subscribe to hull degradation events
    this.unsubHullDegradation = eventBus.on("HULL_DEGRADATION", (payload) => {
      this.enqueueDamage(payload);
    });
  }

  /** Add a new drone to the fleet (e.g., from Robotics Hub + Crew Habitat bonus) */
  addDrone(): string {
    const droneId = `drone_${++this.droneCount}`;
    this.drones.set(droneId, {
      droneId,
      droneClass: "rigger",
      isBusy: false,
      currentTargetId: null,
      dispatchedAt: null,
      taskDurationMs: 0,
      elapsedMs: 0,
    });
    return droneId;
  }

  /** Enqueue a damage event. Called automatically on HULL_DEGRADATION. */
  enqueueDamage(payload: HullDegradationPayload): void {
    const task: DispatchTask = {
      instanceId: payload.instanceId,
      severity: payload.severity,
      source: payload.source,
      queuedAt: Date.now(),
    };
    this.queue.push(task);
    this.tryDispatch();
  }

  /** Manually dispatch a Rigger drone to drag an unanchored module or clear debris */
  dispatchRiggerToDrag(instanceId: string): void {
    const task: DispatchTask = {
      instanceId,
      severity: 3,
      source: "structural",
      taskType: "drag",
      queuedAt: Date.now(),
    };
    this.queue.push(task);
    this.tryDispatch();
  }

  /** Manually dispatch a Welder drone for structural repair */
  dispatchWelder(instanceId: string, severity = 6): void {
    const task: DispatchTask = {
      instanceId,
      severity,
      source: "impact",
      taskType: "repair",
      queuedAt: Date.now(),
    };
    this.queue.push(task);
    this.tryDispatch();
  }

  /** Manually dispatch an emergency Courier drone for critical hazard response */
  dispatchCourierEmergency(instanceId: string, severity = 9): void {
    const task: DispatchTask = {
      instanceId,
      severity,
      source: "meteor",
      taskType: "emergency",
      queuedAt: Date.now(),
    };
    this.queue.push(task);
    this.tryDispatch();
  }

  /**
   * Attempt to dispatch the next task in the queue.
   * Called after every enqueueDamage and after a drone returns.
   */
  tryDispatch(): void {
    if (this.queue.isEmpty) return;

    const availableDrone = this.getAvailableDrone();
    if (!availableDrone) return;

    const task = this.queue.pop()!;
    const droneClass = classForSeverity(task.severity, task.source, task.taskType);

    // Update drone state
    availableDrone.isBusy = true;
    availableDrone.droneClass = droneClass;
    availableDrone.currentTargetId = task.instanceId;
    availableDrone.dispatchedAt = Date.now();
    availableDrone.taskDurationMs = DRONE_DURATIONS[droneClass];
    availableDrone.elapsedMs = 0;

    eventBus.emit("DRONE_DISPATCHED", {
      droneId: availableDrone.droneId,
      droneClass,
      targetInstanceId: task.instanceId,
    });
  }

  /** Advance simulation for busy drones. Restores module health upon completion. */
  update(
    deltaMs: number,
    grid?: {
      getModuleById?: (id: string) => { health: number } | null | undefined;
      updateModuleHealth?: (id: string, hp: number) => void;
    },
  ): void {
    for (const drone of this.drones.values()) {
      if (!drone.isBusy) continue;

      drone.elapsedMs += deltaMs;
      if (drone.elapsedMs >= drone.taskDurationMs) {
        // Resolve task effect
        if (drone.currentTargetId && grid?.getModuleById && grid?.updateModuleHealth) {
          const mod = grid.getModuleById(drone.currentTargetId);
          if (mod) {
            const healAmount =
              drone.droneClass === "courier" ? 25 : drone.droneClass === "welder" ? 20 : 10;
            grid.updateModuleHealth(drone.currentTargetId, Math.min(100, mod.health + healAmount));
          }
        }

        this.droneReturned(drone.droneId);
      }
    }
  }

  /**
   * Signal that a drone has completed its task and is available again.
   * Call this when the drone's repair animation completes.
   */
  droneReturned(droneId: string): void {
    const drone = this.drones.get(droneId);
    if (!drone) return;

    drone.isBusy = false;
    drone.currentTargetId = null;
    drone.dispatchedAt = null;
    drone.taskDurationMs = 0;
    drone.elapsedMs = 0;

    // Immediately check for pending tasks
    this.tryDispatch();
  }

  /** Get all drone states (for HUD rendering). */
  getAllDrones(): DroneState[] {
    return Array.from(this.drones.values());
  }

  /** Get all busy drones. */
  getBusyDrones(): DroneState[] {
    return this.getAllDrones().filter((d) => d.isBusy);
  }

  /** Current queue depth. */
  get pendingTasks(): number {
    return this.queue.size;
  }

  /** Clean up event subscriptions. */
  destroy(): void {
    this.unsubHullDegradation();
    this.queue.clear();
  }

  private getAvailableDrone(): DroneState | null {
    for (const drone of this.drones.values()) {
      if (!drone.isBusy) return drone;
    }
    return null;
  }
}
