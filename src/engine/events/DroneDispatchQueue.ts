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

export type DroneClass = "rigger" | "welder" | "courier";

export interface DispatchTask {
  instanceId: string;
  severity: number;
  source: HullDegradationPayload["source"];
  queuedAt: number; // Date.now()
}

export interface DroneState {
  droneId: string;
  droneClass: DroneClass;
  isBusy: boolean;
  currentTargetId: string | null;
  dispatchedAt: number | null;
}

function classForSeverity(severity: number): DroneClass {
  if (severity >= 6) return "welder";
  if (severity >= 4) return "rigger";
  return "courier";
}

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

  /**
   * Attempt to dispatch the next task in the queue.
   * Called after every enqueueDamage and after a drone returns.
   */
  tryDispatch(): void {
    if (this.queue.isEmpty) return;

    const availableDrone = this.getAvailableDrone();
    if (!availableDrone) return;

    const task = this.queue.pop()!;
    const droneClass = classForSeverity(task.severity);

    // Update drone state
    availableDrone.isBusy = true;
    availableDrone.droneClass = droneClass;
    availableDrone.currentTargetId = task.instanceId;
    availableDrone.dispatchedAt = Date.now();

    eventBus.emit("DRONE_DISPATCHED", {
      droneId: availableDrone.droneId,
      droneClass,
      targetInstanceId: task.instanceId,
    });
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
