# LithoDrop: Save State API Schema

## Overview

LithoDrop saves the entire game state to IndexedDB (client-side) after every successful module snap. When a backend sync service is available, the same payload is POSTed to the persistence endpoint.

The design prioritizes **small payload size** (sparse coordinate system), **conflict safety** (optimistic concurrency via `sync_version`), and **full replayability** (the grid JSON is sufficient to reconstruct the entire visual and logical state of the base).

---

## JSON Save Payload

```json
{
  "save_id": "usr_98765_luna_prime_01",
  "player_id": "usr_98765",
  "planet": "luna_prime",
  "sync_version": 42,
  "timestamp": "2026-09-17T11:22:07Z",
  "economy": {
    "credits": 14500.50,
    "current_tax_tier": 3,
    "upkeep_deficit": false
  },
  "tech_tree": {
    "unlocked_nodes": [
      "prop_gimbal_1",
      "avionics_lidar_1",
      "chassis_ablative_2"
    ],
    "active_overclock": null
  },
  "grid": {
    "anchor_x": 0,
    "anchor_y": 0,
    "modules": [
      {
        "instance_id": "mod_11a",
        "type": "titanium_foundation",
        "q_x": 0,
        "q_y": 0,
        "health": 100.0,
        "is_active": true,
        "metadata": {}
      },
      {
        "instance_id": "mod_12b",
        "type": "fission_reactor",
        "q_x": 0,
        "q_y": 1,
        "health": 85.5,
        "is_active": true,
        "metadata": {
          "cooling_cycles_missed": 0
        }
      },
      {
        "instance_id": "mod_13c",
        "type": "hydroponics_dome",
        "q_x": 1,
        "q_y": 1,
        "health": 92.0,
        "is_active": true,
        "metadata": {}
      }
    ]
  }
}
```

**Key insight:** Using a sparse `(q_x, q_y)` coordinate system means a 200-module base produces a payload of ~8KB — easily transmitted over spotty mobile networks.

---

## TypeScript Types (Client)

```typescript
// src/store/types.ts

export type PlanetId =
  | "luna_prime"
  | "serpentine_rifts"
  | "thalassa"
  | "zephyrus"
  | "the_outer_dark"
  | "vulcanis";

export interface ModuleSaveState {
  instance_id: string;
  type: ModuleType;        // from src/engine/grid/types.ts
  q_x: number;
  q_y: number;
  health: number;          // [0.0 – 100.0]
  is_active: boolean;
  metadata: Record<string, number | string | boolean>;
}

export interface GridSaveState {
  anchor_x: number;
  anchor_y: number;
  modules: ModuleSaveState[];
}

export interface EconomySaveState {
  credits: number;
  current_tax_tier: number;
  upkeep_deficit: boolean;
}

export interface TechTreeSaveState {
  unlocked_nodes: string[];
  active_overclock: string | null;
}

export interface GameSavePayload {
  save_id: string;
  player_id: string;
  planet: PlanetId;
  sync_version: number;
  timestamp: string;       // ISO8601
  economy: EconomySaveState;
  tech_tree: TechTreeSaveState;
  grid: GridSaveState;
}
```

---

## Python Backend Schema (FastAPI + Pydantic)

If a backend sync service is deployed (FastAPI on GCP Cloud Run), this Pydantic model strictly validates incoming payloads:

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Union, Literal
from datetime import datetime

PlanetId = Literal[
    "luna_prime",
    "serpentine_rifts",
    "thalassa",
    "zephyrus",
    "the_outer_dark",
    "vulcanis",
]

ModuleType = Literal[
    "titanium_foundation",
    "solar_array",
    "crew_habitat",
    "fission_reactor",
    "hydroponics_dome",
    "deep_core_drill",
    "shock_absorber_strut",
    "science_lab",
    "robotics_hub",
    "water_extractor",
    "battery_bank",
    "thermal_generator",
    "comms_relay",
    "anchor_project",
]

class ModuleSaveState(BaseModel):
    instance_id: str
    type: ModuleType
    q_x: int
    q_y: int
    health: float = Field(..., ge=0.0, le=100.0)
    is_active: bool
    metadata: Optional[Dict[str, Union[int, float, str, bool]]] = None

class GridSaveState(BaseModel):
    anchor_x: int
    anchor_y: int
    modules: List[ModuleSaveState]

class EconomySaveState(BaseModel):
    credits: float = Field(..., ge=0.0)
    current_tax_tier: int = Field(..., ge=0, le=5)
    upkeep_deficit: bool

class TechTreeSaveState(BaseModel):
    unlocked_nodes: List[str]
    active_overclock: Optional[str] = None

class GameSavePayload(BaseModel):
    save_id: str
    player_id: str
    planet: PlanetId
    sync_version: int = Field(..., ge=0)
    timestamp: datetime
    economy: EconomySaveState
    tech_tree: TechTreeSaveState
    grid: GridSaveState
```

---

## Concurrency Model

### Optimistic Concurrency via `sync_version`

Because LithoDrop is a PWA designed for offline play, a player may build half a base on an airplane while their desktop browser holds a save from an earlier session.

```
Client POSTs save with sync_version=42

Backend logic:
  stored = DB.get(save_id)
  if stored.sync_version >= payload.sync_version:
    return HTTP 409 Conflict
    body: { "server_version": stored.sync_version }
  else:
    DB.upsert(payload)
    return HTTP 200 OK
```

The client on receiving a 409 downloads the server state and shows a merge prompt to the player.

### IndexedDB Schema

```typescript
// Database: "lithodrop-db"
// Object store: "saves"
// keyPath: "save_id"
// indexes: ["player_id", "planet", "sync_version"]

interface IndexedDBSave extends GameSavePayload {
  _localTimestamp: number;   // Date.now() at write time
  _dirty: boolean;           // true if not yet synced to server
}
```

---

## API Endpoints (Backend)

```
POST /saves
  Body: GameSavePayload
  Response: 200 OK | 409 Conflict { server_version: number }

GET /saves/{player_id}/{planet}
  Response: 200 GameSavePayload | 404 Not Found

DELETE /saves/{save_id}
  Response: 204 No Content
```
