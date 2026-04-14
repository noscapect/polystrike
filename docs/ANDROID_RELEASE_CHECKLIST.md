# Android Release Checklist

## Build and runtime readiness

- Verify app boots reliably on target Android browsers/WebView wrappers.
- Confirm WebGL performance is stable on low/mid/high-tier devices.
- Validate memory use during extended sessions (match + debug tools).

## Input and UX

- Define final mobile input scheme (touch look/move/fire/jump/dodge).
- Validate UI readability and tap targets across common screen sizes.
- Ensure menus and overlays scale correctly in portrait/landscape policy.

## Map and file workflows

- Validate JSON export/import with Android file pickers.
- Confirm map files are discoverable and user-friendly to share.
- Test permission handling and failure paths for file access.

## Persistence and safety

- Confirm local data persistence behavior in Android environment.
- Test clear-data scenarios and user messaging.
- Validate map backup/restore guidance in player docs.

## Gameplay quality

- Verify bot difficulty tiers feel distinct on mobile framerate ranges.
- Verify nav learning persistence and match-end auto-save.
- Verify overlays (`Z` nav, `X` heatmap) remain usable for debugging.

## Release operations

- Update version strings and changelog for release candidate.
- Final regression pass on: singleplayer, CTF, map editor, import/export.
- Prepare store assets (description, screenshots, tags, feature bullets).
