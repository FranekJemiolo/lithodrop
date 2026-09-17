/**
 * Vitest global test setup.
 *
 * Mocks browser APIs that are not available in jsdom but are used by
 * the game engine (AudioContext, ResizeObserver, navigator.vibrate).
 */

// ─── AudioContext Mock ────────────────────────────────────────────────────────
class MockAudioContext {
  state = "running";
  sampleRate = 44100;
  currentTime = 0;
  destination = {};

  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 440, setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }

  createGain() {
    return {
      gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      connect: () => {},
    };
  }

  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: { value: 1000 },
      connect: () => {},
    };
  }

  createWaveShaper() {
    return { curve: null, connect: () => {} };
  }

  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }

  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

// ─── ResizeObserver Mock ─────────────────────────────────────────────────────
globalThis.ResizeObserver = class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ─── navigator.vibrate Mock ───────────────────────────────────────────────────
Object.defineProperty(navigator, "vibrate", {
  value: () => true,
  writable: true,
});

// ─── window.matchMedia Mock ───────────────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
