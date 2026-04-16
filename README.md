# Polystrike Arena

Welcome to **Polystrike Arena**, a fast-paced, browser-based first-person shooter inspired by classic arena shooters! Jump right into the action, frag smart AI bots, level up your profile, and even build your own custom arenas right in your browser. 

Play instantly on desktop!

## Features

- **Classic Arena Action:** Choose between high-octane, one-shot-kill **Instagib** or **Classic DM** (featuring health, armor, and weapon pickups).
- **Advanced Bot AI:** Fight against bots with dynamic personalities that react to the match, hold grudges (Nemesis system), and actively seek high ground and cover.
- **Persistent Progression:** Earn XP from every match to rank up from Soldier to 5-Star General. Reach level 100 to Prestige and show off your badge!
- **In-Game Map Editor:** Sculpt your own levels in real-time, save them locally, and export/import them to share with the community.

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
| Jump | Space (double jump available) |
| Dodge | Double-tap WASD on ground |
| Weapon switch | `1..3` or mouse wheel |
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
7. `DM-FLETCHER`

### CTF map

8. `CTF-FACE` (when game mode is `CTF`)

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

## For Developers
If you are looking to host this game yourself or modify the code, you can run a local server using `npx serve .`. The game is built using plain HTML/CSS/JS and Three.js with no build step required.
