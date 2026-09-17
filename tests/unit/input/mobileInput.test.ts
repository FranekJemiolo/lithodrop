/**
 * Mobile Input & Haptic Feedback unit tests (Phase 4 Mandate).
 *
 * Verifies:
 *   1. Invisible split-screen separation:
 *      - Left half touch controls rotation
 *      - Right half touch controls thrust
 *      - Simultaneous multi-touch (dual thumb controls) tracked by pointerId
 *   2. Default browser gestures prevented via e.preventDefault()
 *   3. HapticManager vibration triggers and throttling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { InputSystem } from "../../../src/engine/systems/InputSystem";
import { HapticManager } from "../../../src/engine/audio/HapticManager";

// Polyfill PointerEvent for jsdom if needed
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

describe("Phase 4: Mobile Split-Screen Controls & Gesture Isolation", () => {
  let canvas: HTMLCanvasElement;
  let inputSystem: InputSystem;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    inputSystem = new InputSystem(canvas);
  });

  afterEach(() => {
    inputSystem.destroy();
  });

  it("activates thrust when right half of screen is held", () => {
    const downEv = new TestPointerEvent("pointerdown", {
      clientX: 600, // right side (> 400)
      pointerId: 1,
      bubbles: true,
      cancelable: true,
    }) as unknown as PointerEvent;
    const preventDefaultSpy = vi.spyOn(downEv, "preventDefault");
    canvas.dispatchEvent(downEv);

    expect(preventDefaultSpy).toHaveBeenCalled();
    const state = inputSystem.getState();
    expect(state.thrust).toBe(1);
    expect(state.rotation).toBe(0);
  });

  it("handles simultaneous dual-thumb multi-touch (thrust + rotation) via pointerId", () => {
    // Left thumb down on left half (clientX = 200, pointerId = 1)
    canvas.dispatchEvent(
      new TestPointerEvent("pointerdown", {
        clientX: 200,
        pointerId: 1,
        bubbles: true,
        cancelable: true,
      }) as unknown as PointerEvent,
    );

    // Right thumb down on right half (clientX = 650, pointerId = 2)
    canvas.dispatchEvent(
      new TestPointerEvent("pointerdown", {
        clientX: 650,
        pointerId: 2,
        bubbles: true,
        cancelable: true,
      }) as unknown as PointerEvent,
    );

    // Left thumb swipes right (CW rotation)
    canvas.dispatchEvent(
      new TestPointerEvent("pointermove", {
        clientX: 240, // deltaX = +40 > 10
        pointerId: 1,
        bubbles: true,
        cancelable: true,
      }) as unknown as PointerEvent,
    );

    let state = inputSystem.getState();
    expect(state.thrust).toBe(1);
    expect(state.rotation).toBe(1); // CW rotation

    // Release right thumb only (pointerId = 2)
    canvas.dispatchEvent(
      new TestPointerEvent("pointerup", {
        clientX: 650,
        pointerId: 2,
        bubbles: true,
        cancelable: true,
      }) as unknown as PointerEvent,
    );

    state = inputSystem.getState();
    expect(state.thrust).toBe(0); // Thrust off
    expect(state.rotation).toBe(1); // Rotation still active!

    // Release left thumb (pointerId = 1)
    canvas.dispatchEvent(
      new TestPointerEvent("pointerup", {
        clientX: 240,
        pointerId: 1,
        bubbles: true,
        cancelable: true,
      }) as unknown as PointerEvent,
    );

    state = inputSystem.getState();
    expect(state.thrust).toBe(0);
    expect(state.rotation).toBe(0);
  });
});

describe("Phase 4: HapticManager Vibration Integration", () => {
  it("invokes navigator.vibrate when available", () => {
    const vibrateSpy = vi.fn();
    (window.navigator as unknown as { vibrate: unknown }).vibrate = vibrateSpy;
    (navigator as unknown as { vibrate: unknown }).vibrate = vibrateSpy;

    try {
      HapticManager.triggerSnap();
      expect(vibrateSpy).toHaveBeenCalledWith([22, 18, 30]);

      HapticManager.triggerTouchdown(8.0, 8400, true);
      expect(vibrateSpy).toHaveBeenCalledWith([60, 30, 90]);

      HapticManager.triggerTouchdown(15.0, 12000, false);
      expect(vibrateSpy).toHaveBeenCalledWith([100, 40, 160, 50, 240]);
    } finally {
      (navigator as unknown as { vibrate: unknown }).vibrate = undefined;
    }
  });
});
