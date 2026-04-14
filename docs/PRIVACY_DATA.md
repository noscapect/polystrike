# Privacy and Data Storage

## Summary

Polystrike Arena stores gameplay and customization data locally in your browser using `localStorage`.
No cloud account is required for core singleplayer/debug features.

## What is stored locally

- Player profile (nickname, XP/level/rank/prestige, avatar data URL)
- Singleplayer preferences (map/mode related settings)
- Map editor slots and built-in map override mappings
- Local published map library (up to 99 slots)
- Learned bot navigation graphs (per map/layout)
- Combat heatmap data (per map/layout)

## What is not currently provided

- No in-app cloud backup/sync service for local data
- No in-app online map catalog service

## Data portability

- Maps can be exported/imported as full JSON files.
- Exporting maps is recommended before clearing browser data.

## Data deletion / reset

Because storage is local, deleting browser site data for the app origin will remove saved data.

## Scope note

Storage is browser/device specific. Data from one browser or device does not automatically appear on another.
