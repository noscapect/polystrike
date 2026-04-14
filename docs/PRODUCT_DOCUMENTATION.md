# Polystrike Arena - Product Documentation

## Product overview

Polystrike Arena is a fast-paced browser-based arena FPS inspired by classic Instagib gameplay.  
The current live product focus is singleplayer and debug tooling for map creation, map sharing, and adaptive bot behavior.

Core promise:

- instant pick-up-and-play arena shooting
- strong replayability through map editing and bot adaptation
- player-owned local content (maps, learned bot nav, profile progress)

## Target players

- Players who enjoy old-school arena shooters (UT/Q3 style movement and pacing)
- Players who want to build/customize maps without external editors
- Players who like training bots and experimenting with AI behavior
- Content creators testing maps and combat flow quickly

## Platforms and distribution

- Current platform: desktop browser (WebGL-capable)
- Intended direction: Android release path (with in-app map editing and sharing)
- Distribution model: local browser app served over HTTP

## Current version

- Product version: `1.12`

## Main game modes

### Singleplayer (primary mode)

- Deathmatch Instagib
- Classic Deathmatch (UT-style baseline)
- Capture The Flag (Alpha) (CTF)
- Lobby options:
  - map selection
  - bot count (`1..11`)
  - bot difficulty (`1..5`)
  - match length (`1..30` minutes)

### Debug mode

Two debug experiences are available:

- **Debug room**: showcase/testing map for assets, materials, sounds
- **Debug levels**: in-world map editing + nav training + visualization overlays

## Map roster

### Standard maps

1. GOTHIC ARENA
2. DM-DECK16
3. DM-MORPHEUS
4. DM-PHOBOS
5. DM-CODEX
6. DM-FACTORY

### CTF map

7. CTF-FACE

### Debug map

8. DEBUG LAB

## Key product features

### 1) In-app map editing

Players can edit built-in levels directly in Debug Levels mode:

- place/remove blocks in world space
- adjust block size/material/rotation
- work with per-map edit slots (`1..5`)
- save, load, and reset slot states

### 2) Built-in map override for real gameplay

Edited built-in maps are not debug-only cosmetics:

- saved edits can become gameplay overrides
- those overrides are used in normal singleplayer matches
- restore action is available to revert to original built-in map

### 3) Map publishing and sharing

Two publishing paths are available:

- **Local library** (up to `99` maps): add or replace slots
- **File sharing**: export/import map JSON files

Important product rule:

- map export/import is **full-map payload only** (not delta-only block diffs)

### 4) Adaptive bot navigation learning

Bots can learn map traversal and improve over time:

- auto-learn graph building for movement routes
- support for horizontal and vertical transitions (walk/jump/drop)
- simplification passes for cleaner, human-like route graphs
- hazard memory to reduce repeated fall-off behavior
- path usage integrated into active bot movement

### 5) Continuous learning in regular matches

- optional "always learn" behavior during normal singleplayer
- bot learning can adapt to player tendencies over time
- learned nav is persisted and automatically saved after matches

### 6) Visual intelligence overlays

- **Nav overlay (`Z`)**: shows learned route graph
- **Combat heatmap overlay (`X`)**: shows where fights concentrate by map/layout

### 7) Classic DM ruleset option

- Optional non-instagib ruleset in the singleplayer lobby
- Health + armor combat with weapon/ammo pickups
- Per-map curated item/powerup placements

## Bot difficulty system

Singleplayer bot difficulty has five levels:

1. **Fresh Meat** (easiest)
2. **Cannon Fodder**
3. **Bloodthirsty** (default baseline)
4. **Nightmare**
5. **Unreal** (hardest)

Difficulty scales major bot behavior factors:

- reaction timing
- accuracy/spread
- target refresh cadence
- shooting rhythm
- movement pressure

## Player progression and profile

Persistent profile includes:

- nickname
- XP and level progression
- rank and prestige
- profile avatar image

Progress and profile are stored locally for a persistent offline player identity.

## Player controls (core)

- movement: WASD
- look: mouse
- fire: left mouse
- jump: space (double jump available)
- dodge: double-tap WASD
- scoreboard: Tab (toggle)
- pause: Esc

## Debug level controls (core)

- `E` place block
- `Q` / Delete remove block
- `[` `]` size step
- `M` material cycle
- `R` rotate block
- `1..5` slot select/load
- `K` save slot
- `L` load slot
- `N` new/reset slot
- `O` publish local map
- `J` load local map
- `U` export full JSON map
- `I` import JSON map
- `P` restore original built-in map
- `Y` toggle nav training
- `Z` toggle nav overlay
- `X` toggle combat heatmap overlay
- `B` bake/save nav now

## Data persistence model (product view)

Local browser storage is used for:

- player profile
- map editor slots and map overrides
- local published map library
- learned bot navigation per map/layout
- combat heatmap per map/layout

## Product goals for near-term releases

- stabilize Android-ready UX flow for editing/sharing maps
- further improve bot tactical behavior and anti-clumping responses
- keep overlays and debug tools usable for creators
- maintain full-map portability and backward-safe import handling

## Known scope boundaries

- multiplayer/server code exists but is currently not exposed in active player-facing menu flow
- map sharing is local file based; no cloud backend distribution yet
- localStorage-backed persistence is device/browser scoped
