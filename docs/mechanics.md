# LithoDrop: Game Mechanics Reference

## Physics Constants

### Planetary Gravity

| Planet | Gravity (m/s²) | Notes |
|---|---|---|
| Luna Prime | 1.62 | Earth's moon reference |
| Serpentine Rifts | 4.2 | Dense mineral core |
| Thalassa | 9.1 | Near-Earth, thick hydrosphere |
| Zephyrus | 24.8 | Gas giant (upper atmosphere) |
| The Outer Dark | 0.8 | Rogue planet, icy |
| Vulcanis | 7.4 | Active volcanic world |

### Payload Physics Profiles

| Module | Mass (kg) | Drag Coefficient | Impact Tolerance (m/s) |
|---|---|---|---|
| Titanium Foundation | 8,400 | 0.3 | 12.0 |
| Solar Array | 1,200 | 2.4 | 4.5 |
| Crew Habitat | 3,200 | 0.8 | 7.0 |
| Fission Reactor | 12,000 | 0.45 | 8.0 |
| Hydroponics Dome | 900 | 1.1 | **2.5** (fragile!) |
| Deep Core Drill | 5,500 | 0.22 | 6.0 |
| Shock Absorber Strut | 400 | 0.35 | 20.0 (indestructible) |
| Science Lab | 2,800 | 0.65 | 5.5 |
| Robotics Hub | 3,100 | 0.7 | 6.5 |

### Impact Damage Formula

```
impactDamage = clamp((velocity - tolerance) / tolerance, 0, 1) × 100

Where:
  velocity   = downward velocity at contact (m/s)
  tolerance  = module's impact tolerance (m/s)
  result     = damage percentage [0–100]

Examples:
  Hydroponics Dome at 5 m/s: (5 - 2.5) / 2.5 × 100 = 100% (destroyed)
  Titanium Foundation at 14 m/s: (14 - 12) / 12 × 100 = 16.7% damage
  Foundation at 10 m/s: max(0, 10 - 12) = 0 (perfect landing)
```

---

## Drop Bounty Calculation

The Drop Bounty is a lump-sum credit payout awarded immediately upon successful touchdown.

```
bounty = baseBounty × velocityScore × fuelScore × softnessScore

Where:
  baseBounty    = module.baseCost × 0.15   (15% of module cost)

  velocityScore = clamp(maxVelocityDuringDescent / 50.0, 0.5, 2.0)
                  (faster is riskier = higher payout, capped at 2×)

  fuelScore     = 0.7 + (fuelRemaining × 0.6)
                  (full tank remaining = 1.3×, empty tank = 0.7×)

  softnessScore = 1.0 + clamp(1 - (impactVelocity / tolerance), 0, 0.5)
                  (perfect landing = 1.5×, just surviving = 1.0×)

Maximum theoretical bounty: baseBounty × 2.0 × 1.3 × 1.5 = 3.9×
```

---

## Economy Engine

### Credit Generation

Credits are generated every game tick (1000ms) from Export Resources:

```
creditsPerTick = Σ (module.yieldRate × adjacencyMultiplier × powerEfficiency)

Where:
  adjacencyMultiplier = product of all matching AdjacencyBonuses for this module
  powerEfficiency     = 1.0 if module is powered, 0.0 if unpowered

Example:
  Deep Core Drill (base yield: 15 cr/s)
  + adjacent Science Lab → ×1.25
  + powered: yes
  = 15 × 1.25 × 1.0 = 18.75 cr/s
```

### Corporate Tax Escalation

Every 180 seconds (3 minutes), the tax tier increases:

| Tier | Tax Rate | Notes |
|---|---|---|
| 0 | 2 cr/s | Starting rate (Tutorial) |
| 1 | 5 cr/s | First escalation |
| 2 | 12 cr/s | Expansion required |
| 3 | 25 cr/s | Mid-game pressure |
| 4 | 50 cr/s | Late-game crunch |
| 5 | 90 cr/s | Near-quota urgency |

```
taxPerTick = TAX_TIERS[currentTier]
netPerTick = creditsPerTick - taxPerTick

Bankruptcy triggers when: credits < 0 AND netPerTick < 0
```

### Win Condition

The quota threshold and Anchor Project cost are planet-specific:

| Planet | Quota (cr/s) | Anchor Cost | Anchor Mass |
|---|---|---|---|
| Luna Prime | 100 | 50,000 cr | 45,000 kg |
| Serpentine Rifts | 180 | 90,000 cr | 62,000 kg |
| Thalassa | 250 | 120,000 cr | 55,000 kg |
| Zephyrus | 320 | 180,000 cr | 38,000 kg (weight limit!) |
| The Outer Dark | 200 | 95,000 cr | 50,000 kg |
| Vulcanis | 400 | 250,000 cr | 70,000 kg |

Quota must be sustained for **60 consecutive seconds** before the Anchor Project is authorized.

---

## Adjacency Bonus Table

| Source Module | Required Neighbor | Bonus | Resource |
|---|---|---|---|
| Hydroponics Dome | Crew Habitat | +25% Data output from adjacent Science Labs | data |
| Deep Core Drill | Science Lab | +20% mineral yield | minerals |
| Water Extractor | Hydroponics Dome | +30% food production | food |
| Fission Reactor | Battery Bank | +15% power output (buffered) | power |
| Crew Habitat | Robotics Hub | +1 drone capacity | logistics |
| Science Lab | Comms Relay | +40% Research Data generation | data |
| Thermal Generator | Water Extractor | +50% water extraction (steam) | water |
| Solar Array | Battery Bank | Enables dark cycle operation | power |

---

## Structural Stress Model

Each grid column is evaluated for cantilever torque every time a module is snapped or destroyed.

```
torque(column) = Σ (module.mass × horizontalDistanceFromSupport)

collapseThreshold = foundationsInColumn × 15,000 N·m

If torque > collapseThreshold:
  → emit structural_collapse event
  → destroy all modules in column above overload point
  → each destroyed module emits MODULE_DESTROYED
  → triggers cascade: if destroyed module was support for adjacent column,
    recheck adjacent column immediately
```

---

## Drone Dispatch Priority Queue

The priority queue is a max-heap keyed on `severity` score [0–10].

### Severity Score Calculation

```
severity = baseSeverity(source) × healthFactor × criticalityFactor

baseSeverity:
  meteor:     8
  structural: 7
  acid:       5
  heat:       4
  impact:     6

healthFactor = 1 + (1 - health/100)   (lower health → higher priority)

criticalityFactor:
  fission_reactor:    2.0
  robotics_hub:       1.8
  crew_habitat:       1.5
  science_lab:        1.2
  everything else:    1.0
```

### Drone Pathfinding

Drones traverse the dependency graph using BFS (Breadth-First Search):

```
path = BFS(roboticsHub.coord, targetModule.coord, graph)

If no path exists (orphaned module):
  → drone cannot reach target
  → emit GRID_SEVERED event
  → notify player via HUD
  → module burns down at 3 HP/s until reconnected
```

---

## Tech Tree: Research Data Costs

Research Data is generated by Science Labs (base rate: 2 RD/min). Costs:

### Propulsion & Maneuverability Tier

| Node | Cost (RD) | Prerequisite |
|---|---|---|
| Gimballed Main Thruster | 50 | — |
| RCS Burst Efficiency | 30 | — |
| Gyroscopic Payload Clamps | 80 | Gimballed Thruster |
| Pulse-Detonation Overdrive | 120 | Gimballed Thruster |
| Variable Thrust Vectoring | 200 | Pulse-Detonation + Clamps |

### Telemetry & Avionics Tier

| Node | Cost (RD) | Prerequisite |
|---|---|---|
| Predictive Trajectory Overlay | 40 | — |
| Sub-surface LIDAR | 90 | Trajectory Overlay |
| Faraday Chassis Mesh | 70 | — |
| Cloud-Piercing Sonar | 110 | Sub-surface LIDAR |
| Enhanced Altimeter Array | 60 | Trajectory Overlay |

### Chassis & Materials Tier

| Node | Cost (RD) | Prerequisite |
|---|---|---|
| Ablative Armor Plating | 60 | — |
| Adaptive Hydraulic Gear | 100 | Ablative Armor |
| Rapid-Weave Drone Deployment | 80 | — |
| Composite Hull Weave | 150 | Ablative + Hydraulic |
| Modular Cargo Locks | 70 | — |

### Overclock Mechanic

Activating an overclock on node X:
1. Applies the overclock bonus for 15,000ms
2. Starts a heat accumulation timer: `heat += 1/s`
3. If `heat > 15` before touchdown: thruster meltdown (payload drops freely)
4. Heat resets to 0 on successful touchdown
