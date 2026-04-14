# Player Guide

## Quick start

1. Run a local HTTP server in the project folder.
2. Open the URL in a modern WebGL-capable browser.
3. Choose `Singleplayer` and configure map, bots, difficulty, and match time.

## Core controls

- Move: `W A S D`
- Look: Mouse
- Fire: Left Mouse
- Jump: `Space` (double jump available)
- Dodge: double-tap WASD
- Scoreboard: `Tab`
- Pause: `Esc`

## Singleplayer setup

- Ruleset: `Instagib` or `Classic DM (UT-style)`
- Bot count: `1..11`
- Difficulty:
  - `1` Fresh Meat
  - `2` Cannon Fodder
  - `3` Bloodthirsty
  - `4` Nightmare
  - `5` Unreal
- Modes: Deathmatch Instagib / CTF

## Map editing in Debug Levels

Enter `Debug -> Enter debug levels` and use:

- `E` place block
- `Q`/Delete remove block
- `[` `]` block size
- `M` material
- `R` rotate
- `1..5` slots
- `K` save
- `L` load
- `N` reset slot

## Publish and share maps

- `O` publish local map (library up to 99 slots)
- `J` load local map
- `U` export full-map JSON
- `I` import JSON
- `P` restore original built-in map

## Bot learning and overlays

- `Y` toggle nav training
- `Z` nav overlay (learned graph)
- `B` bake/save nav now
- `X` combat heatmap overlay (fight hotspots)

Use the debug menu toggle to keep bots learning during normal singleplayer matches.

## Classic DM quick notes

- Left click = primary fire, right click = alt fire.
- Weapon switch with `1..3` or mouse wheel.
- Pick up health, armor, ammo, weapons, and UDamage powerup on map.
