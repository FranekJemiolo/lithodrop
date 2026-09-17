# Contributing to LithoDrop: Orbital Syndicate

Thank you for your interest in contributing to LithoDrop! This document explains how to get your development environment set up, how to run the test suite, and how to submit high-quality pull requests.

---

## Development Environment Setup

### Prerequisites

- **Node.js 22+** — [Download](https://nodejs.org/)
- **Git** — standard
- **Python 3.8+** — required for `pre-commit` hooks

### First-Time Setup

```bash
# 1. Fork the repository, then clone your fork
git clone https://github.com/<your-username>/lithodrop.git
cd lithodrop

# 2. Install Node.js dependencies
npm install

# 3. Install pre-commit tool (Python)
pip install pre-commit

# 4. Register git hooks
pre-commit install

# 5. Start the dev server
npm run dev
# → http://localhost:5173
```

---

## Code Quality Gates

Every commit is checked by `prek` (the pre-commit runner). The following checks must pass before a commit is accepted:

| Check      | Command                | Tool          |
| ---------- | ---------------------- | ------------- |
| Format     | `npx prettier --check` | Prettier 3    |
| Lint       | `npm run lint`         | oxlint        |
| Types      | `npx tsc --noEmit`     | TypeScript ~6 |
| Unit Tests | `npm run test:unit`    | Vitest 5      |

Run all checks manually at any time:

```bash
prek run
# or individually:
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
```

---

## Testing

### Unit Tests

Unit tests live in `tests/unit/` and test **pure logic only** — no DOM, no PixiJS, no network. They run in jsdom via Vitest.

```bash
npm run test:unit
# Run in watch mode during development:
npx vitest --watch tests/unit
```

**What to test:**

- Physics math (impact thresholds, fuel consumption curves)
- Economy engine (credit accumulation formulas, tax tier escalation)
- Grid logic (adjacency rules, BFS pathfinding, structural stress)
- Priority queue invariants
- Tech tree unlock prerequisites

### Integration Tests

Integration tests live in `tests/integration/` and test **the bridge between engine systems** — e.g., does a Matter.js collision event correctly update the GridState?

```bash
npm run test:integration
```

### End-to-End Tests

E2E tests use Playwright and run against the live Vite dev server. They simulate real user interactions: tapping buttons, performing landings, dragging modules.

```bash
# Install Playwright browsers (first time only)
npx playwright install --with-deps chromium

# Run E2E tests
npm run test:e2e

# Run only mobile tests (CI default)
npm run test:e2e:mobile

# Run with UI (debugging)
npx playwright test --ui
```

---

## Pull Request Guidelines

### Branch Naming

```
feature/my-feature-name
fix/issue-description
docs/what-was-documented
refactor/what-was-refactored
```

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(physics): add gyroscopic payload clamp upgrade
fix(grid): correct BFS orphan detection on diagonal modules
docs(mechanics): add Drop Bounty formula derivation
test(economy): add tax tier escalation edge cases
```

### Pull Request Checklist

Before opening a PR, ensure:

- [ ] `prek run` passes (all pre-commit hooks green)
- [ ] `npm run test` passes (unit + integration)
- [ ] `npm run test:e2e:mobile` passes
- [ ] `npm run build` succeeds without errors
- [ ] New code has corresponding unit or integration tests
- [ ] Documentation updated if public API or game mechanic changed
- [ ] No `console.log` left in production code paths

### PR Size

Keep PRs focused. A PR that touches a single system (e.g., only the economy engine) is much easier to review than one touching physics, UI, and audio. If your change is large, split it into multiple sequential PRs.

---

## Architecture Notes

Before writing code, read:

- [`docs/architecture.md`](docs/architecture.md) — Understand the layered architecture (PixiJS canvas ↔ EventBus ↔ React HUD).
- [`docs/mechanics.md`](docs/mechanics.md) — Physics and economy formulas before touching numbers.
- [`src/engine/events/EventTypes.ts`](src/engine/events/EventTypes.ts) — Add new events here first; never add ad-hoc string messages.

### Critical Architectural Rules

1. **PixiJS → React communication happens exclusively via the EventBus.** Never import a React component into an engine file.
2. **React → PixiJS communication happens via `gameApp` method calls.** Pass the `GameApp` instance through React context, not as prop-drilling.
3. **Physics runs at a fixed 50Hz tick.** Never call `Matter.Engine.update()` inside a PixiJS ticker directly — use `PhysicsWorld.step()`.
4. **Module types are defined in `src/engine/grid/types.ts`.** Adding a new module type requires adding it to the `ModuleType` union, `ModuleRegistry`, `AdjacencyRules`, and the save schema.
5. **All tests must be deterministic.** No `Math.random()` in tests — use seeded RNG or fixed inputs.

---

## Questions

Open a [GitHub Discussion](https://github.com/FranekJemiolo/lithodrop/discussions) for questions, design proposals, or feature brainstorms before opening a PR.
