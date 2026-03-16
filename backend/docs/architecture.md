# Architecture

## Source Layout

- `src/app`: app shell (router/providers) and app-global state only.
- `src/features/canvas`: canvas engine, tools, hooks, and canvas-specific UI/state.
- `src/features/room`: room page, room collaboration state/services, room UI panels.
- `src/features/home`: home page and home-only components.
- `src/features/dashboard`: dashboard page and dashboard-only components.
- `src/shared`: reusable modules used by more than one feature.

## Ownership Rules

1. Keep feature-specific code inside that feature.
2. Move code to `shared` only when reused by multiple features.
3. Prefer imports via aliases:
   - `@app/*`
   - `@features/*`
   - `@shared/*`
4. Avoid deep cross-feature imports into private internals.

## Current Priorities

1. Split very large files (`RoomPage.jsx`, `CanvasManager.js`) into smaller modules.
2. Add test coverage for canvas commands and room collaboration flows.
