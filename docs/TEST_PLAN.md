# Test Plan

## Pre-flight

- Start app via local HTTP server.
- Verify menu opens and profile data loads.
- Confirm version shown in UI matches release target.

## Singleplayer baseline

- Start Deathmatch on each standard map.
- Validate player spawn, bot spawn, score tracking, timer, and match end flow.
- Validate CTF mode starts only on CTF map and flag logic works.
- Validate both rulesets (`Instagib`, `Classic DM`) start and play without mode crossover bugs.

## Bot systems

- Verify bot count (`1..11`) applies correctly.
- Verify difficulty (`1..5`) changes feel and behavior (reaction, accuracy, pressure).
- Verify always-learn setting persists and continues learning across normal matches.
- Verify learned nav auto-saves at match end.
- In Classic DM, verify bots can damage (non-instagib TTK), switch attack profile by range, and collect pickups.

## Classic DM systems

- Verify player health/armor updates and death timing behave as expected.
- Verify weapon switching (`1..3`, mouse wheel) and alt-fire (`RMB`) behavior.
- Verify curated map pickups spawn, get collected, and respawn on timer.
- Verify UDamage pickup grants temporary amplified damage and expires correctly.

## Map editor

- Enter Debug Levels mode and verify edit controls (place/remove, size, material, rotate).
- Save/load/reset slots (`1..5`) per map.
- Confirm built-in map override appears in normal singleplayer.
- Verify restore original map (`P`) removes override impact in gameplay.

## Map publish/share

- Publish local map to free slot and replace existing slot.
- Export map and confirm file is full-map JSON payload.
- Import map and test both "load now" and "store local" flows.
- Validate max local library behavior at 99 slots.

## Overlays / diagnostics

- Toggle nav overlay (`Z`) and confirm graph visibility.
- Bake nav (`B`) and confirm save status feedback.
- Toggle heatmap overlay (`X`) and verify hotspot rendering after combat events.

## Regression checks

- Ensure no missing-texture regressions between debug and singleplayer map render paths.
- Ensure no severe bot freezing/clumping regressions under normal match load.

## Exit criteria

- No blockers in game start, match flow, map load, or save/import/export.
- All critical controls function and persist as expected.
- Known issues are documented and accepted for release.
