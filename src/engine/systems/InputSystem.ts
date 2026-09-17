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

  // Touch state
  private leftPointerDown = false;
  private rightPointerDown = false;
  private leftSwipeDirection: -1 | 0 | 1 = 0;

  // Canvas split point (updated on resize)
  private canvasMidX = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasMidX = canvas.width / 2;

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

  /** Returns the current normalized input state */
  getState(): InputState {
    const thrustKey =
      this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.keys.has("Space");
    const rotLeftKey = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const rotRightKey = this.keys.has("KeyD") || this.keys.has("ArrowRight");

    // Touch: right half = thrust, left half = rotate based on swipe
    const touchThrust = this.rightPointerDown;
    const touchRotLeft = this.leftPointerDown && this.leftSwipeDirection === -1;
    const touchRotRight = this.leftPointerDown && this.leftSwipeDirection === 1;
    const touchRotNone = this.leftPointerDown && this.leftSwipeDirection === 0;

    const thrust = thrustKey || touchThrust ? 1 : 0;

    let rotation: -1 | 0 | 1 = 0;
    if (rotLeftKey || touchRotLeft) rotation = -1;
    else if (rotRightKey || touchRotRight) rotation = 1;
    else if (touchRotNone && this.leftPointerDown) rotation = 0;

    // Overclock: Shift+Space or double-tap (tracked separately)
    const overclockPrevious =
      this.prevKeys.has("ShiftLeft") || this.prevKeys.has("ShiftRight");
    const overclockCurrent =
      this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const overclockPressed = overclockCurrent && !overclockPrevious;

    const pausePrevious = this.prevKeys.has("Escape");
    const pauseCurrent = this.keys.has("Escape");
    const pausePressed = pauseCurrent && !pausePrevious;

    return { thrust, rotation, overclockPressed, pausePressed };
  }

  /** Update canvas split point (call on window resize) */
  updateCanvasWidth(width: number): void {
    this.canvasMidX = width / 2;
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
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x < this.canvasMidX) {
      this.leftPointerDown = true;
      this.leftSwipeDirection = 0; // Will be set on move
    } else {
      this.rightPointerDown = true;
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.leftPointerDown) return;
    // Swipe direction: positive movementX = right (CW rotation)
    if (Math.abs(e.movementX) > 2) {
      this.leftSwipeDirection = e.movementX > 0 ? 1 : -1;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x < this.canvasMidX) {
      this.leftPointerDown = false;
      this.leftSwipeDirection = 0;
    } else {
      this.rightPointerDown = false;
    }
  };
}
