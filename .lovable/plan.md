## Goal
When the Vite dev server drops and comes back, the preview sometimes stays stuck on the "server connection lost. Polling for restart..." state. Add a small dev-only helper that detects reconnection and reloads the page automatically so the preview is never stale.

## Approach
Vite's HMR client pings the server but does not always trigger a full reload after a long disconnect. We'll add a tiny dev-only watchdog that:

1. Tracks the WebSocket / ping state via `import.meta.hot` events (`vite:ws:disconnect`, `vite:ws:connect`).
2. Once a disconnect is observed, starts polling `/@vite/ping` every 1s.
3. As soon as a ping succeeds after a prior disconnect, calls `location.reload()`.
4. Guarded by `if (import.meta.hot)` so it is completely stripped from production builds.

## Files
- **New:** `src/lib/dev-auto-reload.ts` — the watchdog described above. No-op outside dev.
- **Edit:** `src/main.tsx` — add a single side-effect import: `import "./lib/dev-auto-reload";`.

## Notes
- No UI changes, no production impact, no new dependencies.
- Safe with the existing Vite HMR — we only reload on the disconnect → reconnect transition, never on the initial connection.
