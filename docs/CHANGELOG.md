# Changelog

All notable changes to this project are documented in this file.

## Versioning policy

- Bugfix release: increase patch -> `x.xx.1` (then `x.xx.2`, ...)
- Feature release: increase minor -> `x.12.x` style progression
- Major release: increase middle major band -> `x.2x.x`
- Complete new version line: increase first digit -> `1.xx.x`, `2.xx.x`, ...

## 1.12.1

- Fixed menu/input regressions introduced during Classic DM integration.
- Fixed Classic ruleset activation path so item/powerup spawns initialize reliably.
- Improved Classic DM bot movement/combat behavior (less orbit hopping).
- Upgraded rocket visuals (impact burst + in-flight glow/trail).

## 1.12.0

- Added singleplayer bot difficulty selector (`1..5`): Fresh Meat, Cannon Fodder, Bloodthirsty, Nightmare, Unreal.
- Added per-map combat heatmaps with debug overlay toggle (`X`) in Debug Levels mode.
- Added product-facing documentation files and docs organization.
- Added Classic DM ruleset option (UT-style baseline) alongside Instagib.
- Added classic health/armor model, weapon/ammo flow, and curated per-map item spawns.
- Added classic bot behavior hooks (weapon choice + pickup seeking).

## 1.10.0

- Introduced Debug Levels in-app map editor.
- Added local map publishing (up to 99 slots) and full-map JSON export/import sharing.
- Added built-in map override flow for normal singleplayer gameplay.
- Added restore original built-in map action.
- Added bot nav auto-learn system with nav overlay (`Z`) and bake/save (`B`).
- Added always-learn option for normal singleplayer and match-end nav persistence.
- Added waypoint graph simplification and crowd/ledge safety improvements.
