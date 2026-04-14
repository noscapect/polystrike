# Polystrike Arena — InstaGib

Browser-based first-person arena shooter inspired by classic InstaGib. Built with plain HTML/CSS/JS and Three.js (no build step).

## Current gameplay status

- **Singleplayer is the active mode.**
- **Multiplayer and Store are visible but disabled in the main menu** (placeholder entries).
- Includes a **Debug mode** with a dedicated showroom map for assets.
- Includes **Debug Level Mode Map Editor** (player-side local map editing and custom slots).

## Requirements

- Modern desktop browser with WebGL + pointer lock.
- Local HTTP server (do not open as `file://`).

## Quick start

```bash
npx serve .
```

Open the URL shown by `serve` and launch from the menu.

## Main menu

Top-level options:

- `Singleplayer` (active)
- `Multiplayer` (disabled / greyed out)
- `Store` (disabled / greyed out)
- `Debug` (active)
- `Settings` (active)
- `Quit` (active)

### Singleplayer lobby

Singleplayer has a lobby with:

- map selection
- ruleset selection (`Instagib` or `Classic DM`)
- bot count (`1..11`, UI default `5`)
- bot difficulty (`1..5`):
  - `1` Fresh Meat (easiest)
  - `2` Cannon Fodder
  - `3` Bloodthirsty (default)
  - `4` Nightmare
  - `5` Unreal (hardest)
- match length in minutes

Classic DM includes:

- health + armor combat model
- starter loadout and weapon pickups
- ammo pickups and respawn timers
- powerup pickup (`UDamage`)

### Settings

- mouse sensitivity
- nickname
- master volume
- audio output mode (`Stereo` / `Mono`)
- bot skill preset (`Arcade` / `UT Classic` / `Sweaty`)

### Pause menu

Press `Esc` in match:

- `Resume`
- `Quit match` (returns to main menu safely)

## Persistent player profile

Profile data is persisted in `localStorage` (`ta_player_profile_v1`), including:

- nickname
- total XP
- level
- rank
- prestige
- uploaded profile picture

### Level/rank/prestige model

- Levels run `1..100` per prestige.
- Rank changes every 10 levels:
  - Soldier (1-10)
  - Corporal (11-20)
  - Sergeant (21-30)
  - Lieutenant (31-40)
  - Captain (41-50)
  - Major (51-60)
  - Colonel (61-70)
  - Brigadier General (71-80)
  - General (81-90)
  - 5-Star General (91-100)
- After 100, progression rolls into next prestige (`P1`, `P2`, ...).

In-match progression HUD shows avatar, rank, level, and XP bar. Level/rank changes trigger non-intrusive toasts.

## Controls

| Action | Input |
|---|---|
| Move | `W A S D` / arrows |
| Look | Mouse |
| Fire | Left mouse |
| Alt fire (Classic DM) | Right mouse |
| Jump | Space (double jump available) |
| Dodge | Double-tap WASD on ground |
| Weapon switch (Classic DM) | `1..3` or mouse wheel |
| Scoreboard | Tab (toggle) |
| Pause | Esc |

## Maps

### Standard maps

1. `GOTHIC ARENA`
2. `DM-DECK16`
3. `DM-MORPHEUS`
4. `DM-PHOBOS`
5. `DM-CODEX`
6. `DM-FACTORY`

### CTF map

7. `CTF-FACE` (when game mode is `CTF`)

### Debug map

8. `DEBUG LAB` (entered from `Debug` menu)

Debug Lab includes:

- bot model lineup
- broad material gallery (map + bot + weapon families)
- interactive sound pads (full sound action catalog)
- image gallery wall (currently includes `assets/menu-bg.png`)

### Debug Level Mode map editor

In `Debug -> Enter debug levels`, players can edit existing maps and save their own variants locally:

- place/remove blocks in-world
- cycle block size/material/rotation
- save/load per-map custom slots (`1..5`)
- reset slot to start a new personal map layout
- publish maps to a local map library with up to 99 slots (`add` or `replace`)
- export/import maps as JSON for sharing with other players

Saved map edits are stored in browser `localStorage`. Built-in map edits can be applied as gameplay overrides and are used in normal singleplayer matches as well.

### Map publish/share controls (debug level mode)

- `O`: publish current edited map locally (choose add/replace, max 99 slots)
- `J`: load a local published map slot
- `U`: export current map as a **full** `.json` map file to the device (not delta-only)
- `I`: import map from local `.json` file (load now or store locally)
- `P`: restore original built-in map (disables gameplay override for current built-in map)
- `Y`: toggle auto-learn bot navigation training (learns horizontal + vertical waypoint links)
- `Z`: toggle nav debug overlay (nodes + walk/jump/drop links)
- `X`: toggle combat heatmap overlay (where fights happen most on this map/layout)
- `B`: bake/save nav profile immediately

### Bot navigation learning notes

- Debug menu includes an `Always learn during normal singleplayer matches` toggle.
- When enabled, bots continue adapting nav behavior during regular matches.
- Learned nav data is persisted per map/layout and automatically baked/saved at match end.
- Use `Z` in debug level mode to inspect the current learned nav graph.

### Advanced Bot AI features

- **Dynamic Personality**: Bots evaluate their performance (kill/death streaks) and health to shift states (e.g., confident, desperate, hunted), affecting aggression, accuracy, and movement.
- **Nemesis System**: Bots remember opponents who kill them repeatedly and may focus them for revenge.
- **Cover & Line-of-Sight**: Bots dynamically use physical map geometry to break line-of-sight and take cover when at a disadvantage.
- **High-Ground Awareness**: Bots calculate vertical advantage and actively seek elevated platforms to improve combat effectiveness.

### Combat heatmap notes

- Combat heat is recorded from kill/death events during gameplay.
- Heat is stored per map/layout in browser `localStorage`.
- Use `X` in debug level mode to visualize high-activity combat zones.

## Audio system

- Procedural + optional file-based sounds (`audio/`).
- Master output graph with:
  - master gain (volume)
  - stereo path
  - mono fold-down path

## Project layout

| Path | Role |
|---|---|
| `index.html` | HUD/menu UI + script loading |
| `game.js` | Core gameplay loop, UI state, profile/progression |
| `maps.js` | Arena builders, spawns, debug lab |
| `bots.js` | Bot AI + procedural meshes/weapons |
| `audio.js` | Sound synthesis/loading/playback + output graph |
| `mp-client.js` | Multiplayer client code (currently not exposed in menu flow) |
| `server/` | Authoritative MP server + admin routes (kept in repo) |
| `vendor/` | Bundled Three.js modules |

## Multiplayer/server note

Multiplayer code and Node server are still present in the repository, but the player-facing menu currently disables Multiplayer while singleplayer/debug iteration continues.
