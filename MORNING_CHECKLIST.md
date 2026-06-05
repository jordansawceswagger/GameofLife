# Morning Checklist - 2026-06-05

Good morning. The skeleton is built and the whole test suite is green. This is your
map to what landed overnight and what to poke at first.

## What got built

- **Step 1. Scaffolding + self-testing harness.** Electron + TypeScript + React +
  Vite, Vitest wired from the start, strict tsconfig, Tailwind (dark default),
  electron-builder for a macOS `.app`. `npm test` runs `tsc --noEmit` then the full
  suite.
- **Step 2. Menu-bar tray + popover.** Tray with template icon, tooltip, left-click
  toggle, right-click Quit. Frameless, transparent, blur-to-hide popover with pure,
  unit-tested positioning math.
- **Step 3. Global hotkeys + view router.** All 7 accelerators
  (Control+Command+ Up/Down/Left/Right/Plus/-/C) register and IPC-send to the
  renderer, which routes each to a stub view (`<h1>{view}</h1>` + Close).
- **Step 4. Preload IPC bridge.** Fully typed `window.gol` (no `any` leaks):
  readFile, writeFile, runClaudeCode, getDailyNote, rollMovementCard,
  crmList/Get/AppendHistory/Mutate/Import, onNavigate. Locked CRM + vault types.
- **Step 5. Vault file layer.** Typed read/write for daily notes (frontmatter +
  section extraction), movement cards (micro/meso/macro), and the task queue
  (NOW/NEXT/LATER), plus completion-log and queue row appends.
- **Step 6. Claude Code wrapper.** `runClaudeCode` spawns `claude -p ... --output-format json`,
  extracts `result`, and never throws (timeout, non-zero exit, spawn failure, bad
  JSON all return `{response:'', error}`). Verified against the real CLI.
- **Step 7. CRM two-store data layer (the prize).** Locked-schema types, hookable
  crash-safe atomic writer with prior-state backups, AVATAR-ROUTE parser, single
  write path, the full mutation API, idempotent import, and the entity-link reverse
  map. This is the most thoroughly tested part of the build.
- **Step 8. Done chime.** A CC0 Tibetan singing-bowl tone (soft, slow swell, no
  percussive onset) at `assets/sounds/done.wav` with credits.

## How to verify (do this first)

1. `cd ~/Documents/Claude/Projects/game-of-life-app`
2. `npm install` (in case anything is missing)
3. `npm test` -- expect green (94 tests, 19 files, 0 failures, 0 skipped)
4. `npm run typecheck` -- expect 0 errors
5. `npm run dev` -- expect a tray icon to appear in the menu bar
6. Press each hotkey, expect the right stub popover (morning-intake, done, pause,
   playbook, add-to-queue, strike, crm)
7. Populate the CRM once, then list it:
   - In the running app's devtools console: `await window.gol.crmImport()` then
     `await window.gol.crmList()` -- expect ~12 contacts from the real roster.

## Decisions I made overnight

See `DECISIONS.md` for the full list, each with a "Test for Jordan" and a "Consider
adding." The ones you specifically asked me to flag:

- **lastTouch on source refresh:** NO, import does not bump it (system event).
- **S-key from terminal status:** no-op; leave terminal only via `crmSetTerminal` or
  the new `crmResetToLinear`.
- **Backup retention:** 50 prior-state snapshots, pruned oldest-first.
- **Empty/missing vault:** typed `VaultFileNotFoundError`, writes self-heal the dir.
- **First-launch import:** the store is ensured but import is NOT auto-run; you
  trigger `crmImport()` explicitly (the confirmation UI is deferred).

Other judgment calls documented there: package is CommonJS, a custom atomic writer
(so the fsync/rename crash seam is testable), avatar is NOT inherited from the
AVATAR-ROUTE tag, tier is derived from the "TIER N" marker, crmAddNote materializes
top-level notes plus history, and the YAML date normalization.

## What you should add (deferred / next steps)

- **CRM popover UI** (Phase 2c) -- the data layer is done; the keyboard-first
  N/S/A/M/R/E/L popover is next. Why deferred: the data layer was the prize tonight.
- **Real Done overlay + morning-intake chat + playbook insert** -- views are stubs.
  Why deferred: skeleton-only scope.
- **HTML viewer + playbook.js repointing to LIVE CRM** -- separate task, explicitly
  out of scope tonight.
- **Calendar/EventKit integration, launchd plist, Whisper voice** -- later phases.
- **Signing / notarization, app-icon polish** -- deferred per the brief.

## What might break first

- **Electron dev launch (ESM/CJS + preload path).** The popover loads
  `../preload/index.js`; if `vite-plugin-electron` emits a different filename/format
  on your machine, the popover may open blank. First thing to check if `npm run dev`
  misbehaves.
- **`claude` not on Electron's PATH.** The CLI lives at `~/.local/bin/claude`, which
  a GUI-launched Electron may not have on PATH. If `runClaudeCode` returns a spawn
  error, set `GOL_CLAUDE_BIN=/Users/jordan/.local/bin/claude`.
- **Daily-note filename assumption.** I assumed `40_Daily Notes/<YYYY-MM-DD>.md`. If
  your generator names them differently, adjust `dailyNotePath()` in
  `src/main/vault.ts`.
- **The chime is ~43.9 seconds long.** Valid and gentle, but long for a "done" cue.
  Consider trimming to ~3s with a fade for the overlay.
- **Tray icon is a generated placeholder** (a plain black disc). Replace with real
  art before you care about polish.
- **CSP is intentionally loose** in `index.html` for dev HMR; tighten it for
  production builds.
- **Popover positioning** is math-tested but not validated on a real multi-display
  menu bar; the screen-edge clamp may need a true `screen` lookup.

## Tests that did not pass (if any)

None. `npm test` exits 0: 94 tests across 19 files, 0 failures, 0 skipped. Every
step's tests pass, including the CRM crash-recovery and idempotent-import suites and
a read-only smoke import against the real `fca_crm_seed.json`. Nothing was deferred
to a documented failure.

After the build I ran an adversarial correctness review over the 11 data-layer /
vault / claude modules. It confirmed the headline invariants are correct (import
never touches STATE, atomic-write crash safety, backup pruning, status/avatar cycle
wrap, claude.ts settle/timer handling) and surfaced five real edge bugs, all now
fixed with regression tests: AVATAR-ROUTE field matching is now delimiter-anchored
(free text can't poison a field) and bracket-aware; `parseTier` is word-boundary
anchored (no "fron-TIER" false match); `crmRebuildMaterialized` compares timestamps
by epoch, not string order; `importFromSource` aborts with a clear error on a missing
roster instead of a raw ENOENT; and entity-link ids are de-duplicated per file.

## Sound file

- **Source URL:** https://bigsoundbank.com/tibetan-bowl-singing-s1109.html
  (direct: https://bigsoundbank.com/UPLOAD/bwf-en/1109.wav)
- **License:** CC0 (Public Domain), royalty-free, no attribution required.
- **Parasympathetic fit (my judgment):** It fits. I chose the friction/"singing"
  variant deliberately over a struck bowl, because a struck bowl has a percussive
  onset transient (sympathetic activation). The waveform begins at near-silence and
  swells in gradually over the first second with no click or sharp attack: warm, low,
  and sustained. The one caveat is length (~43.9s); for a "done" cue you will likely
  want to trim it to a few seconds with a fade-out.
