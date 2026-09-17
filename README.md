# LithoDrop: Orbital Syndicate

[![CI](https://github.com/FranekJemiolo/lithodrop/actions/workflows/ci.yml/badge.svg)](https://github.com/FranekJemiolo/lithodrop/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/FranekJemiolo/lithodrop/actions/workflows/deploy.yml/badge.svg)](https://github.com/FranekJemiolo/lithodrop/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-~6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8-E91E8C)](https://pixijs.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8)](https://web.dev/progressive-web-apps/)

**LithoDrop: Orbital Syndicate** is a 2D physics-based arcade/strategy Progressive Web App. You play as the "Dropmaster" for an off-world colonization mega-corp — manually piloting delivery landers through treacherous planetary atmospheres, hazardous weather systems, and crushing gravity wells, then snapping the landed modules together to build a thriving, interconnected colony.

🌐 **Live Demo:** [https://franekjemiolo.github.io/lithodrop/](https://franekjemiolo.github.io/lithodrop/)

---

## Features

### Action Phase — The Descent
- **2D Rigid-Body Physics** — PixiJS v8 (WebGL) rendering + Matter.js physics at a fixed 50Hz simulation tick, decoupled from the render frame rate.
- **Dynamic Payload Aerodynamics** — Each module type has a unique mass and drag profile. Dropping a wide Solar Array creates a sail effect in crosswinds; a narrow Deep Core Drill slices straight through.
- **Split-Screen Touch Controls** — Left half of screen rotates the lander; right half fires the main thruster. No virtual joysticks to miss.
- **Kinetic Visual Feedback** — Thruster plumes modulated by LFO, heat haze displacement filter, brief hull squash on hard landings, seismic shockwave dust rings.
- **Telemetry Reticle** — A circular HUD element that tracks with the ship: left arc = fuel, right arc = hull integrity, center vector = velocity/trajectory.

### Strategy Phase — Base Construction
- **Sparse Grid System** — Modules snap to integer (qx, qy) coordinates. The save payload stays tiny regardless of base sprawl.
- **Dependency Graph** — BFS-driven graph over all placed modules for power, water, air, and data flow. Severed connections instantly orphan downstream modules.
- **Adjacency Bonuses** — Strategic placement rewards: Hydroponics Dome adjacent to Crew Habitat boosts Data output by 25%.
- **Structural Physics** — Cantilevering logic: stacking heavy modules without a foundation generates torque that eventually snaps magnetic locks.
- **Event-Driven Drone Dispatch** — Rigger, Welder, and Courier drones are dispatched from a max-heap priority queue keyed on damage severity.

### Meta-Game
- **6-Planet Campaign** — Luna Prime → Serpentine Rifts → Thalassa → Zephyrus → The Outer Dark → Vulcanis. Each planet introduces unique biomes, gravity profiles, and hazards.
- **Hex-Grid Tech Tree** — Three aerospace disciplines (Propulsion, Telemetry, Chassis) with cross-node dependencies. Overclock any node for 15 seconds at the cost of heat buildup.
- **Special Delivery Contracts** — High-risk, high-reward drops with unique mechanics (executive G-force limits, antimatter feathering, live alien payload).
- **Adaptive Music** — Web Audio API stem-mixing: descent tension → touchdown silence → healthy base lo-fi → crisis dissonance, all mixed in real time.

### PWA & Performance
- **60 FPS on Mobile** — PixiJS WebGL batching + Matter.js fixed-tick physics keep rendering smooth on mid-range Android and iOS.
- **Fully Offline** — Workbox `CacheFirst` caches all game assets on first visit. Play on an airplane.
- **Home Screen App** — `display: fullscreen`, `orientation: landscape`, haptic feedback via `navigator.vibrate()`.
- **IndexedDB Persistence** — Autosaves base grid state after every module snap using `idb`. Optimistic concurrency via `sync_version`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Rendering | **PixiJS v8** (WebGL2) |
| Physics | **Matter.js 0.20** (fixed 50Hz tick) |
| Particles | **@pixi/particle-emitter 5** |
| UI / HUD | **React 19** + Vanilla CSS |
| Audio | **Web Audio API** (procedural synthesis) |
| Build | **Vite 8** + TypeScript ~6 |
| PWA | **vite-plugin-pwa** + Workbox |
| Unit Tests | **Vitest 5** |
| E2E Tests | **Playwright 1.63** |
| Linting | **oxlint** |
| Formatting | **Prettier 3** |
| Pre-commit | **prek** |
| CI/CD | **GitHub Actions** → GitHub Pages |

---

## Local Development

### Prerequisites

- Node.js 22+
- Git

### Quick Start

```bash
# Clone
git clone https://github.com/FranekJemiolo/lithodrop.git
cd lithodrop

# Install dependencies
npm install

# Start dev server
npm run dev
# → Open http://localhost:5173
```

### Available Scripts

```bash
npm run dev           # Start Vite dev server with HMR
npm run build         # TypeScript check + production bundle
npm run preview       # Preview production build locally

npm run lint          # Run oxlint
npm run format        # Run Prettier (auto-fix)
npm run format:check  # Run Prettier (check only, used in CI)
npm run typecheck     # TypeScript type check only

npm run test          # Run all unit + integration tests
npm run test:unit     # Run unit tests only
npm run test:integration   # Run integration tests only
npm run test:e2e      # Run Playwright E2E tests (all projects)
npm run test:e2e:mobile    # Run E2E on Mobile Chrome only
npm run test:e2e:desktop   # Run E2E on Desktop Chrome only
```

### Pre-commit Hooks (prek)

Install pre-commit hooks to catch issues before they reach CI:

```bash
# Install pre-commit (Python tool)
pip install pre-commit

# Install the hooks
pre-commit install

# Or run manually
prek run
```

Hooks run on staged files: Prettier format check → oxlint → TypeScript check → unit tests.

---

## Project Structure

```
lithodrop/
├── src/
│   ├── main.tsx                   # Bootstrap: PixiJS + React dual-root
│   ├── index.css                  # Design system tokens + global resets
│   ├── engine/
│   │   ├── GameApp.ts             # PixiJS Application + scene orchestrator
│   │   ├── events/
│   │   │   ├── EventBus.ts        # Typed pub/sub singleton
│   │   │   ├── EventTypes.ts      # All game event payload types
│   │   │   ├── PriorityQueue.ts   # Max-heap for drone dispatch
│   │   │   └── DroneDispatchQueue.ts
│   │   ├── physics/
│   │   │   ├── PhysicsWorld.ts    # Matter.js engine + fixed-tick runner
│   │   │   ├── LanderBody.ts      # Lander rigid body + center-of-mass
│   │   │   └── TerrainBody.ts     # Static terrain collision geometry
│   │   ├── grid/
│   │   │   ├── types.ts           # ModuleType, GridCoord, AdjacencyBonus
│   │   │   ├── GridState.ts       # Sparse coordinate map
│   │   │   ├── DependencyGraph.ts # BFS resource flow + pathfinding
│   │   │   ├── AdjacencyRules.ts  # Placement rules + bonus table
│   │   │   └── ModuleRegistry.ts  # Module catalog (mass, function, cost)
│   │   ├── economy/
│   │   │   ├── EconomyEngine.ts   # Credit tick + tax escalation
│   │   │   ├── DropBounty.ts      # Post-touchdown payout calculator
│   │   │   └── TaxScheduler.ts    # 3-minute tier escalation
│   │   ├── hazards/
│   │   │   ├── HazardEngine.ts    # Spawns planet hazard events
│   │   │   └── PlanetHazardConfig.ts
│   │   ├── audio/
│   │   │   ├── AudioEngine.ts     # AudioContext + sprite loader
│   │   │   ├── ThrusterSynth.ts   # LFO-driven procedural engine sound
│   │   │   └── AdaptiveMusicMixer.ts # Stem cross-fading
│   │   ├── techtree/
│   │   │   ├── TechTree.ts        # Hex-grid unlock + overclock
│   │   │   └── TechNodes.ts       # All upgrade definitions
│   │   ├── entities/
│   │   │   ├── Lander.ts          # PixiJS lander sprite + particle emitter
│   │   │   ├── TelemetryReticle.ts
│   │   │   ├── BaseModule.ts      # Placed module sprite + state overlay
│   │   │   └── Drone.ts           # Animated drone following BFS path
│   │   ├── particles/
│   │   │   ├── ThrusterPlume.ts
│   │   │   ├── ImpactEffects.ts
│   │   │   └── WeldingEffects.ts
│   │   ├── systems/
│   │   │   ├── InputSystem.ts     # Unified keyboard + touch input
│   │   │   ├── DescendPhaseSystem.ts
│   │   │   └── BuildPhaseSystem.ts
│   │   ├── planets/               # Per-planet config + biome logic
│   │   ├── win/                   # Win condition + Anchor Project
│   │   └── assets/AssetLoader.ts
│   ├── scenes/
│   │   ├── TitleScene.ts          # Animated title screen
│   │   ├── TutorialScene.ts       # 5-stage Dropmaster Certification
│   │   ├── DescendScene.ts        # Lander descent orchestrator
│   │   └── BuildScene.ts          # Base construction orchestrator
│   ├── components/
│   │   ├── HUD/                   # React HUD overlay components
│   │   ├── BuildUI/               # Module dock + drag-and-snap UI
│   │   ├── TechTreeUI/            # Hex-grid tech tree panel
│   │   └── SpecialContracts/      # Contract briefing modals
│   └── store/
│       ├── GameStore.ts           # Reactive signal store (EventTarget)
│       └── PersistenceService.ts  # IndexedDB save/load via idb
├── tests/
│   ├── setup.ts                   # Vitest browser API mocks
│   ├── unit/                      # Pure logic tests
│   ├── integration/               # Engine + state bridge tests
│   └── e2e/                       # Playwright full-flow tests
├── docs/
│   ├── vision.md                  # Game design manifesto
│   ├── architecture.md            # System architecture + Mermaid diagrams
│   ├── mechanics.md               # Physics + economy formulas
│   ├── planets.md                 # Planetary campaign guide
│   └── api/save-schema.md         # JSON save payload spec
├── tools/prek/                    # prek CLI wrapper
├── .github/workflows/             # CI + Deploy workflows
└── public/icons/                  # PWA app icons
```

---

## Documentation

- [docs/vision.md](docs/vision.md) — Game design manifesto & creative direction
- [docs/architecture.md](docs/architecture.md) — System architecture with Mermaid diagrams
- [docs/mechanics.md](docs/mechanics.md) — Physics, economy, and adjacency formulas
- [docs/planets.md](docs/planets.md) — Planetary campaign progression & hazard catalog
- [docs/api/save-schema.md](docs/api/save-schema.md) — JSON save payload & Pydantic backend schema
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute

---

## License

MIT © Franek Jemiolo. See [LICENSE](LICENSE).
