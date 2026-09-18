/**
 * InputSystem — Unified keyboard + touch input handler.
 *
 * Provides a normalized input state object that all game systems read.
 * Supports:
 *   - Desktop: W/Up = thrust, A/Left = rotate CCW, D/Right = rotate CW, Space = overclock
 *   - Mobile: Left-half hold = rotate (swipe direction), Right-half hold = thrust
 *     The split-screen division is at 50% of the canvas width.
 *
 * Input state is sampled once per frame by DescendPhaseSystem.
 * No game logic lives here — this is a pure input mapper.
 */

import { HapticManager } from "../audio/HapticManager";

export interface InputState {
  /** [0–1] throttle level */
  thrust: number;
  /** -1 = CCW, 0 = none, +1 = CW */
  rotation: -1 | 0 | 1;
  /** True on the frame the overclock key is first pressed */
  overclockPressed: boolean;
  /** True on the frame the pause key is first pressed */
  pausePressed: boolean;
}

export class InputSystem {
  private keys = new Set<string>();
  private prevKeys = new Set<string>();

  // Touch state with discrete pointerId tracking for split-screen separation
  private leftPointerDown = false;
  private rightPointerDown = false;
  private activeLeftPointerId: number | null = null;
  private activeRightPointerId: number | null = null;
  private leftStartX = 0;
  private leftSwipeDirection: -1 | 0 | 1 = 0;

  // Canvas split point (updated on resize)
  private canvasMidX = 0;
  private canvasHeight = 0;
  private rightTouchY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasMidX = canvas.width / 2;
    this.canvasHeight = canvas.height;

    // Keyboard
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    // Touch / Pointer (works for both mouse and touch)
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  /** Called once per frame BEFORE game logic reads input */
  beginFrame(): void {
    this.prevKeys = new Set(this.keys);
  }

  private virtualThrust = 0;
  private virtualRotation: -1 | 0 | 1 = 0;

  /** Programmatic control override for on-screen UI buttons */
  setVirtualThrust(thrust: number): void {
    this.virtualThrust = Math.max(0, Math.min(1, thrust));
  }

  /** Programmatic rotation override for on-screen UI buttons */
  setVirtualRotation(rotation: -1 | 0 | 1): void {
    this.virtualRotation = rotation;
  }

  /** Returns active status for individual control channels (used for HUD visual feedback) */
  getControlActiveStates(): {
    thrust: boolean;
    hover: boolean;
    rotLeft: boolean;
    rotRight: boolean;
  } {
    const thrustKey = this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.keys.has("Space");
    const hoverKey = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const rotLeftKey = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const rotRightKey = this.keys.has("KeyD") || this.keys.has("ArrowRight");

    const touchHover =
      this.rightPointerDown && this.rightTouchY > (this.canvasHeight || 600) * 0.72;
    const touchFullThrust = this.rightPointerDown && !touchHover;
    const touchRotLeft = this.leftPointerDown && this.leftSwipeDirection === -1;
    const touchRotRight = this.leftPointerDown && this.leftSwipeDirection === 1;

    const vThrust = this.virtualThrust >= 0.8;
    const vHover = this.virtualThrust > 0 && this.virtualThrust < 0.8;
    const vRotLeft = this.virtualRotation === -1;
    const vRotRight = this.virtualRotation === 1;

    return {
      thrust: thrustKey || touchFullThrust || vThrust,
      hover: hoverKey || touchHover || vHover,
      rotLeft: rotLeftKey || touchRotLeft || vRotLeft,
      rotRight: rotRightKey || touchRotRight || vRotRight,
    };
  }

  /** Returns the current normalized input state */
  getState(): InputState {
    const thrustKey = this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.keys.has("Space");
    const hoverKey = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const rotLeftKey = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const rotRightKey = this.keys.has("KeyD") || this.keys.has("ArrowRight");

    // Touch: right half = thrust (lower zone = hover, upper zone = full thrust)
    let touchThrust = 0;
    if (this.rightPointerDown) {
      touchThrust = this.rightTouchY > (this.canvasHeight || 600) * 0.72 ? 0.45 : 1.0;
    }

    const touchRotLeft = this.leftPointerDown && this.leftSwipeDirection === -1;
    const touchRotRight = this.leftPointerDown && this.leftSwipeDirection === 1;
    const touchRotNone = this.leftPointerDown && this.leftSwipeDirection === 0;

    let thrust = 0;
    if (thrustKey) thrust = 1.0;
    else if (hoverKey)
      thrust = 0.45; // Fine-tune hover / soft-landing thrust
    else if (this.virtualThrust > 0) thrust = this.virtualThrust;
    else if (touchThrust > 0) thrust = touchThrust;

    let rotation: -1 | 0 | 1 = 0;
    if (rotLeftKey || touchRotLeft) rotation = -1;
    else if (rotRightKey || touchRotRight) rotation = 1;
    else if (this.virtualRotation !== 0) rotation = this.virtualRotation;
    else if (touchRotNone && this.leftPointerDown) rotation = 0;

    // Overclock: Shift+Space or double-tap (tracked separately)
    const overclockPrevious = this.prevKeys.has("ShiftLeft") || this.prevKeys.has("ShiftRight");
    const overclockCurrent = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const overclockPressed = overclockCurrent && !overclockPrevious;

    const pausePrevious = this.prevKeys.has("Escape");
    const pauseCurrent = this.keys.has("Escape");
    const pausePressed = pauseCurrent && !pausePrevious;

    return { thrust, rotation, overclockPressed, pausePressed };
  }

  /** Update canvas dimensions (call on window resize) */
  updateCanvasWidth(width: number, height?: number): void {
    this.canvasMidX = width / 2;
    if (height !== undefined) this.canvasHeight = height;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    // Prevent spacebar from scrolling the page
    if (e.code === "Space") e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    // Prevent default browser behaviors (pull-to-refresh, page swipe back, scroll)
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < this.canvasMidX) {
      this.leftPointerDown = true;
      this.activeLeftPointerId = e.pointerId;
      this.leftStartX = x;
      // Immediate steer on tap based on left/right half of the steering quadrant:
      if (x < this.canvasMidX * 0.45) {
        this.leftSwipeDirection = -1; // Tap left = Steer CCW
      } else if (x > this.canvasMidX * 0.55) {
        this.leftSwipeDirection = 1; // Tap right = Steer CW
      } else {
        this.leftSwipeDirection = 0; // Neutral deadband / swipe trigger
      }
    } else {
      this.rightPointerDown = true;
      this.activeRightPointerId = e.pointerId;
      this.rightTouchY = y;
      HapticManager.triggerThrusterPulse();
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    e.preventDefault();
    if (e.pointerId === this.activeLeftPointerId && this.leftPointerDown) {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const deltaX = x - this.leftStartX;
      if (Math.abs(deltaX) > 10) {
        this.leftSwipeDirection = deltaX > 0 ? 1 : -1;
      } else if (Math.abs(e.movementX) > 1.5) {
        this.leftSwipeDirection = e.movementX > 0 ? 1 : -1;
      }
    }
    if (e.pointerId === this.activeRightPointerId && this.rightPointerDown) {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      this.rightTouchY = e.clientY - rect.top;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    e.preventDefault();
    if (e.pointerId === this.activeLeftPointerId) {
      this.leftPointerDown = false;
      this.activeLeftPointerId = null;
      this.leftSwipeDirection = 0;
    }
    if (e.pointerId === this.activeRightPointerId) {
      this.rightPointerDown = false;
      this.activeRightPointerId = null;
    }
  };
}
