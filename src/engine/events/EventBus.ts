/**
 * EventBus — Typed, lightweight publish/subscribe event system.
 *
 * Uses a simple Map<EventType, Set<Handler>> pattern. All game systems
 * communicate exclusively through this bus to maintain strict decoupling
 * between the PixiJS engine layer and the React HUD layer.
 *
 * Usage:
 *   eventBus.on("PAYLOAD_TOUCHDOWN", (ev) => { ... });
 *   eventBus.emit("PAYLOAD_TOUCHDOWN", { velocity: 3.2, moduleType: "titanium_foundation" });
 *   eventBus.off("PAYLOAD_TOUCHDOWN", handler);
 */

import type { GameEventMap } from "./EventTypes";

type EventHandler<T> = (payload: T) => void;

class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly listeners = new Map<string, Set<EventHandler<any>>>();

  /**
   * Subscribe to a typed game event.
   * Returns an unsubscribe function for convenient cleanup.
   */
  on<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  /** Unsubscribe a previously registered handler. */
  off<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): void {
    this.listeners.get(event)?.delete(handler);
  }

  /** Emit a typed event to all registered handlers. */
  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }

  /** Remove all handlers for a given event (useful on scene teardown). */
  clear(event: keyof GameEventMap): void {
    this.listeners.delete(event);
  }

  /** Remove ALL handlers (use on full game reset only). */
  clearAll(): void {
    this.listeners.clear();
  }
}

// Singleton instance shared across the entire application
export const eventBus = new EventBus();
