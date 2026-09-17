/**
 * HapticManager — Device vibration & tactile feedback (Mobile UX).
 *
 * Integrates navigator.vibrate() API for mobile devices:
 *   - Thruster pulses: rhythmic short, crisp haptic bursts
 *   - Touchdown / Impacts: mass- and velocity-scaled kinetic thuds
 *   - Structural collapses: deep sustained rumbling vibration
 *   - Magnetic snaps / UI clicks: sharp tactical clicks
 */

export class HapticManager {
  private static lastThrusterVibrate = 0;

  private static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    );
  }

  /** Short, sharp haptic pulse for active thruster burn (throttled to 140ms) */
  static triggerThrusterPulse(): void {
    if (!this.isSupported()) return;
    const now = Date.now();
    if (now - this.lastThrusterVibrate < 140) return;
    this.lastThrusterVibrate = now;
    try {
      navigator.vibrate(18);
    } catch {
      // Ignore vibration permission or browser restrictions
    }
  }

  /** Heavy, kinetic haptic response on touchdown */
  static triggerTouchdown(velocity: number, mass: number, survived: boolean): void {
    if (!this.isSupported()) return;
    try {
      if (!survived) {
        // Catastrophic crash rumble
        navigator.vibrate([100, 40, 160, 50, 240]);
      } else if (velocity > 5.0 || mass > 8000) {
        // Heavy payload landing
        navigator.vibrate([60, 30, 90]);
      } else {
        // Crisp soft landing
        navigator.vibrate([35, 20, 45]);
      }
    } catch {
      // Ignore errors
    }
  }

  /** Crisp haptic for magnetic snap into grid */
  static triggerSnap(): void {
    if (!this.isSupported()) return;
    try {
      navigator.vibrate([22, 18, 30]);
    } catch {
      // Ignore errors
    }
  }

  /** Heavy sustained rumble for structural collapse */
  static triggerStructuralCollapse(): void {
    if (!this.isSupported()) return;
    try {
      navigator.vibrate([90, 40, 140, 50, 220]);
    } catch {
      // Ignore errors
    }
  }

  /** Light micro-haptic for UI button clicks */
  static triggerUIClick(): void {
    if (!this.isSupported()) return;
    try {
      navigator.vibrate(12);
    } catch {
      // Ignore errors
    }
  }
}
