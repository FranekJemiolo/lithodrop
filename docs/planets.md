# LithoDrop: Planetary Campaign Guide

## Campaign Progression

Planets are unlocked sequentially. Each world introduces mechanics absent in all previous planets, ensuring each campaign remains a fresh challenge.

```
Luna Prime → Serpentine Rifts → Thalassa → Zephyrus → The Outer Dark → Vulcanis
(Tutorial)   (Canyon Maze)     (Ocean)    (Gas Giant) (Darkness)      (Volcanic)
```

---

## Planet 1: Luna Prime

**Tagline:** *The Proving Ground. No excuses.*

### Environment
- **Gravity:** 1.62 m/s² (low — payloads fall gently but don't brake naturally)
- **Atmosphere:** None (vacuum)
- **Terrain:** Flat grey regolith with gentle crater rims
- **Day/Night Cycle:** 14 Earth-days dark / 14 days light

### The Descent
Perfect, predictable Newtonian physics. No wind, no drag. Every mistake is entirely the player's fault. A Titanium Foundation dropped from 500m in vacuum falls exactly as the equations predict.

**Key lesson:** Momentum is unforgiving. In vacuum, there is no air resistance to bail you out. Start your braking burn earlier than feels necessary.

### Base Building
Flat, stable bedrock. Ideal conditions except for the dark cycle:

**Solar Array Limitation:** During the 14-day lunar night, Solar Arrays produce 0 power. Battery Banks are **mandatory** to survive dark cycles. Players who build a solar-only base will face a base-wide blackout on their first nightfall.

### Hazards
| Hazard | Severity | Frequency |
|---|---|---|
| Micro-meteorite shower | Low | Rare |
| Temperature extremes | Passive | Constant |
| Dust coating (Solar Array efficiency) | Low | After landing |

### Win Condition
- **Quota:** 100 cr/s sustained for 60 seconds
- **Anchor Project:** Lunar Space Elevator Tether
  - Mass: 45,000 kg (requires 6 Titanium Foundation base)
  - Power to activate: 300 units
  - Effect on activation: Localized surface tremor (minor), permanent high-speed ore shipment bonus

---

## Planet 2: The Serpentine Rifts

**Tagline:** *The canyon doesn't care about your fuel budget.*

### Environment
- **Gravity:** 4.2 m/s²
- **Atmosphere:** Thin (minimal drag — parachutes marginally effective)
- **Terrain:** Colossal interlocking canyon network, walls rising 2km above narrow floors

### The Descent
You cannot drop straight down. Landing zones are at the **bottom of labyrinthine crevices**. The descent path requires banking hard left, then hard right, threading the needle between canyon walls moving at speed.

**New mechanic: G-force limit** — Banking at extreme angles generates G-force on the payload. Heavy modules have a structural G-tolerance; exceed it and latches fail, dropping the payload prematurely.

### Base Building
Canyon floors are 4–8 modules wide maximum. Verticality is **enforced**. Bases grow as towers anchored into cliff faces using Shock Absorber Struts.

**Cliff Anchor Struts:** A new module type unlocked here. Fires a magnetic bolt into the vertical rock face, providing lateral support for overhanging modules.

### Hazards
| Hazard | Severity | Frequency |
|---|---|---|
| Rockslide | Medium | After heavy landings |
| Acoustic resonance (tall towers) | Medium | Constant (wind at altitude) |
| Narrow descent corridors | Structural | Always |

---

## Planet 3: Thalassa

**Tagline:** *Balance or drown.*

### Environment
- **Gravity:** 9.1 m/s²
- **Atmosphere:** Dense (strong natural deceleration — burns protect against fast entry)
- **Terrain:** Global ocean, no solid ground
- **Sea State:** Perpetual 2–4m swell with periodic storm surges

### The Descent
Atmospheric friction is intense. Entering the atmosphere too fast triggers thermal ablation — your payload's heat shield degrades and the module catches fire from below 3km altitude.

**Optimal profile:** Arrive with minimal velocity, use the atmosphere as a brake, deploy a drag chute above the cloud layer, then manage final descent precisely.

### Base Building
**No ground.** Your base is a floating pontoon city anchored to submarine pillars.

**Buoyancy mechanic:** Every module has a buoyancy value. The total base buoyancy must exceed total mass. Placing a Fission Reactor on one side without counterbalancing causes the pontoon to tilt, submerging modules.

**Wave physics:** Periodic storm surges tilt the pontoon 5–10 degrees. Tall, narrow tower builds will sway and eventually topple. Wide, low-profile bases are optimal.

### Hazards
| Hazard | Severity | Frequency |
|---|---|---|
| Storm surge (pontoon tilt) | High | Every 8 minutes |
| Submersion damage | High | When tilted >15° |
| Corrosive saltwater spray | Low | Constant (coastal modules) |
| Tsunami (seabed quake) | Critical | Rare |

---

## Planet 4: Zephyrus

**Tagline:** *You are the heaviest thing allowed here.*

### Environment
- **Gravity:** 24.8 m/s² (intense — in upper atmosphere; drops to 18 m/s² at platform altitude)
- **Atmosphere:** Extreme crosswinds, violent thermal columns, perpetual lightning storms
- **Base Platform:** A massive, pre-positioned aerostat floating at the upper cloud deck

### The Descent
Crosswinds are stratified in opposite directions at different altitudes. Dropping a wide Solar Array through 3 different wind bands simultaneously will rip it apart without constant counter-thrusting.

The platform is visible — but it's moving. Wind pushes it horizontally. Your landing target is a moving object.

### Base Building
The aerostat platform has a **strict weight limit of 2,400 tonnes**. Heavy Titanium Foundations and Fission Reactors are extremely expensive to place. The platform begins sinking into deeper, crushing atmospheric layers if overloaded.

**Power advantage:** Above the cloud deck, Solar Arrays operate at 200% efficiency — no dark cycle.

### Hazards
| Hazard | Severity | Frequency |
|---|---|---|
| Shearing crosswinds | High | Constant |
| Lightning discharge (EMP) | Medium | Every 3–5 min |
| Platform weight overload | Critical | Builds up gradually |
| Thermal downdraft (microburst) | High | Sporadic |

---

## Planet 5: The Outer Dark

**Tagline:** *The void stares back.*

### Environment
- **Gravity:** 0.8 m/s²
- **Atmosphere:** None (pitch black — no stars visible, no sun)
- **Terrain:** Iron-ice plains, absolute zero surface temperature
- **Lighting:** Artificial only

### The Descent
**Pitch black.** Your visual rendering replaces the world with a wireframe LIDAR display (requires Sub-surface LIDAR tech tree upgrade). Without it, you are flying blind — instruments only.

Velocity vector, fuel gauge, and altimeter are the only data you have.

### Base Building
**The Morale Mechanic:** Engineers develop psychological deterioration from the absolute isolation and darkness. Base efficiency degrades as morale falls.

**Morale-affecting modules:**
- Recreation Hall: +15 morale/cycle
- Observation Dome (with artificial star projector): +25 morale/cycle
- Communication Array (connects to home): +20 morale/cycle

Without morale modules, base efficiency drops by 5% per minute, compounding.

### Hazards
| Hazard | Severity | Frequency |
|---|---|---|
| Cryogenic equipment failure | High | Cold snap events |
| Instrument malfunction | Medium | Radiation events |
| Engineer abandonment (morale=0) | Critical | If morale collapses |
| Micro-meteor swarm (dark space debris) | Medium | Random |

---

## Planet 6: Vulcanis

**Tagline:** *Everything here wants to melt.*

### Environment
- **Gravity:** 7.4 m/s²
- **Atmosphere:** Thick ash clouds, sulfur dioxide, superheated pockets
- **Terrain:** Active caldera, thin crust, magma vents, pyroclastic flows

### The Descent
Thermal updrafts randomly push the lander upward during descent. You must actively thrust downward through updrafts to maintain trajectory control. Ash clogs standard thruster nozzles — requires the Composite Hull Weave tech upgrade, or thrusters progressively lose efficiency.

### Base Building
Thin crust = constant risk of Seismic Liquefaction. Every landing with a heavy payload has a chance to destabilize the ground, starting a sinkhole timer.

**Geothermal vents:** Cryo-Geyser equivalent, but with superheated steam. Thermal Generators placed directly over active vents provide 400 power units — but require continuous cooling array attachment or they melt.

**Heat management:** Modules within 1 grid space of magma vents take constant heat damage. Cooling Arrays (new module type) negate this but consume 30 power units.

### Hazards
| Hazard | Severity | Frequency |
|---|---|---|
| Seismic liquefaction (heavy drops) | High | After every landing |
| Pyroclastic flow | Critical | Every 15 min |
| Ash thruster clog | Medium | Constant (without upgrade) |
| Lava tube collapse | High | After quakes |
| Eruption (localized quake) | Critical | Rare |

### Win Condition
- **Quota:** 400 cr/s sustained for 60 seconds
- **Anchor Project:** Planetary Terraforming Seed Engine
  - Mass: 70,000 kg (heaviest in the game)
  - Power to activate: 800 units
  - Landing requirement: Must land within a crater basin with at least 8 Titanium Foundations pre-laid
  - Effect on activation: Begins atmospheric nitrogen seeding — cinematic ending cutscene
