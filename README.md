# Game of Life (app)

macOS menu-bar productivity app. Phase 2 skeleton: a working foundation (tray,
global hotkeys, IPC bridge, vault file layer, Claude Code subprocess wrapper, and
the locked two-store CRM data layer), not a feature-complete app.

This repo is a sibling of the Obsidian vault at
`/Users/jordan/Documents/Claude/Projects/Game of Life/`. The app reads the vault
and reads the SOURCE CRM roster, but it never writes into either. App-owned CRM
state lives at `~/GameOfLife/crm/crm.json`.

## Stack

- Electron + TypeScript, React + Vite (`vite-plugin-electron`, `vite-plugin-electron-renderer`)
- Tailwind CSS, dark mode default
- Zustand for light renderer state
- Vitest + @testing-library/react for the test harness
- electron-builder for macOS `.app` output (signing/notarization deferred)

## Run

```bash
cd ~/Documents/Claude/Projects/game-of-life-app
npm install
npm run dev          # launches Vite + Electron; a tray icon appears in the menu bar
```

Hotkeys (global):

| Hotkey             | View           |
| ------------------ | -------------- |
| Control+Cmd+Up     | morning-intake |
| Control+Cmd+Down   | done           |
| Control+Cmd+Left   | pause          |
| Control+Cmd+Right  | playbook       |
| Control+Cmd+=      | add-to-queue   |
| Control+Cmd+-      | strike         |
| Control+Cmd+C      | crm            |

## Test

The build is self-testing. `npm test` runs the type-checker and the full Vitest
suite. Final acceptance: `npm test` exits 0 with all suites green.

```bash
npm test                       # tsc --noEmit, then vitest run (everything)
npm run typecheck              # tsc --noEmit only
npm run test:watch            # vitest in watch mode
npm test -- tests/crm          # run one module's suite in isolation
```

## CRM: first import

The LIVE CRM store does not exist until you import from the SOURCE roster.
Import copies SOURCE fields and initializes app-owned STATE per contact.

From the running app (renderer), call the bridge:

```js
await window.gol.crmImport()   // returns { added, refreshed, removed }
await window.gol.crmList()     // returns the contacts
```

Or from a Node REPL against the built main bundle:

```bash
npm run build
node -e "require('./dist-electron/main/crm/import.js').importFromSource().then(console.log)"
```

Run `crmImport()` once to populate `~/GameOfLife/crm/crm.json`. Run it again any
time the SOURCE roster changes: existing contacts get their SOURCE fields
refreshed, app-owned STATE is never touched, and contacts dropped from SOURCE are
flagged `source_removed` (never deleted).

## Layout

```
src/main/        Electron main process (tray, hotkeys, vault, claude, crm/)
src/preload/     contextBridge: the typed window.gol surface
src/renderer/    React app (views routed by hotkey IPC events)
tests/           Vitest suites + fixtures (no real user data mutated)
assets/sounds/   done chime + license credits
```

See `DECISIONS.md` for every judgment call made during the build, and
`MORNING_CHECKLIST.md` for the morning briefing.
