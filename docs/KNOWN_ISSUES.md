# Known Issues

## Gameplay / AI

- Bot behavior can vary significantly per map when learned nav data is sparse or stale.
- On complex vertical maps, bots may still occasionally choose suboptimal routes before enough learning samples exist.
- Combat heatmap quality depends on match volume; very short sessions may produce low-signal overlays.

## Map editor / sharing

- Map sharing is file based (JSON import/export); no online map browser yet.
- LocalStorage-backed map data is browser/device specific.

## Platform / deployment

- App must be served over HTTP (not `file://`) for normal behavior.
- Multiplayer code exists in repository but is currently disabled in player-facing menu flow.

## Workarounds

- Run several matches (or auto-learn sessions) on a map before evaluating final bot route quality.
- Use Debug Levels overlay tools (`Z`, `X`, `B`) to inspect and refine nav/flow.
- Export important custom maps to JSON as backup before clearing browser data.
