# Decisions

Every judgment call made during the overnight build. Each entry tells you what to
test in the morning to confirm the call is right for you.

---

## Decision: package is CommonJS, not ESM

**Context.** Electron main, the Vite renderer, Vitest, and the TS config files can
each be ESM or CJS, and mixing them is the single most common source of
"works in dev, explodes in build" breakage.

**Call.** `package.json` has no `"type": "module"` (so Node treats `.js` as
CommonJS). `vite-plugin-electron` emits CommonJS for the Electron main and preload.
The renderer is ESM (it runs in Chromium via Vite). Config files (`vite.config.ts`,
`vitest.config.ts`) use ESM `export default` and are loaded through esbuild;
`tailwind.config.js` / `postcss.config.js` use `module.exports`.

**Rationale.** CommonJS main/preload loads in any Electron version with no ESM
loader caveats (sandboxed preload scripts cannot be ESM). Tests and type-checking
are bundler-driven and indifferent to the package type, so this maximizes runtime
reliability without costing test ergonomics.

**Test for Jordan.** Run `npm run dev`. Expect the tray icon to appear and a
popover to open with no `ERR_REQUIRE_ESM` / `Cannot use import statement` errors in
the terminal. If you see those, the main/preload output format is the culprit.

**Consider adding.** Phase 2a: revisit ESM main once the Electron version in use is
pinned and known to support an ESM entry cleanly.

---

## Decision: custom atomic writer instead of write-file-atomic

**Context.** The spec suggests `write-file-atomic`, but it also requires a test
that force-exits the process *between fsync and rename* to prove crash recovery.
`write-file-atomic` does not expose a hook at that exact point.

**Call.** `src/main/crm/atomic.ts` implements the atomic write directly: write to
`crm.json.tmp`, `fsync`, run an injectable `onBeforeRename` hook (the test's crash
point), then `rename`. No `write-file-atomic` dependency.

**Rationale.** The crash-path test is an explicit, non-deferrable acceptance
criterion. A hookable in-house writer is the only way to test the fsync/rename
seam, and the implementation is ~30 lines following the same tmp-fsync-rename
contract the schema document specifies.

**Test for Jordan.** Run `npm test -- tests/crm/atomic-write.test.ts`. Expect green:
it writes, crashes before rename, and asserts the original `crm.json` is intact with
an orphan `.tmp` that the cleanup pass removes.

**Consider adding.** Maybe: swap in `write-file-atomic` for production writes and
keep the custom writer only in tests, if you would rather depend on the battle-
tested library for the real path.

---

## Decision: electron 33, conservative dep ranges

**Context.** Host Node is v25.4.0 (bleeding edge). Dependency majors had to install
cleanly and type-check on it.

**Call.** Electron `^33`, Vite `^5`, Vitest `^2`, Tailwind `^3`, React `^18`,
`vite-plugin-electron` `^0.28`. All caret ranges on well-established majors.

**Rationale.** These versions are mutually compatible and predate any churn that
might not yet be settled on Node 25. Electron ships its own Node runtime, so the
host's Node 25 only drives build tooling (which all support it).

**Test for Jordan.** Run `npm install` then `npm test`. Expect a clean install and a
green suite. If install fails on the Electron binary download, it is a network/
mirror issue, not a version issue; re-run with a warm cache.

**Consider adding.** Phase 2a: pin exact versions via a committed `package-lock.json`
(it is committed) and consider Tailwind 4 once its config story stabilizes.

---

## Decision: daily-note filename convention

**Context.** The vault's `40_Daily Notes/` folder is empty, so there is no existing
file to infer the naming from. The template frontmatter uses `date: {{date:YYYY-MM-DD}}`.

**Call.** Daily notes live at `<vault>/40_Daily Notes/<YYYY-MM-DD>.md` (e.g.
`2026-06-05.md`). The vault root defaults to the real vault path and is overridable
via the `GOL_VAULT_ROOT` env var (tests point it at a temp dir).

**Rationale.** `YYYY-MM-DD.md` is the standard Obsidian daily-note pattern and
matches the template's date format, so it should line up with however the launchd
generator (a separate task) ends up naming files.

**Test for Jordan.** Decide your daily-note generator's filename. If it writes
`2026-06-05 Friday.md` instead of `2026-06-05.md`, change `dailyNotePath()` in
`src/main/vault.ts` to match. Run `npm test -- tests/vault.test.ts` after any change.

**Consider adding.** Phase 2a: read the Obsidian daily-notes plugin config to derive
the format instead of hard-coding it.

---

## Decision: normalize YAML-parsed dates back to strings

**Context.** `gray-matter` (js-yaml) auto-parses an unquoted `date: 2026-06-05` into
a JavaScript `Date`, not a string. That broke the daily-note round-trip test and
would surprise any caller treating `frontmatter.date` as a string.

**Call.** `readDailyNote` coerces `frontmatter.date` to a `YYYY-MM-DD` string on read
(`coerceDateString` in `src/main/vault.ts`).

**Rationale.** The locked types declare `date: string`; normalizing on read keeps the
type honest and makes read -> write -> read stable. Only the `date` key is coerced;
other fields are left as YAML produced them.

**Test for Jordan.** Run `npm test -- tests/vault.test.ts` (the round-trip test). If
you later add other date-typed frontmatter keys you want as strings, quote them in
the template or extend `coerceDateString`.

**Consider adding.** Maybe: a custom js-yaml schema on the gray-matter engine so no
frontmatter value is ever auto-parsed into a Date.

---

## Decision: empty / missing vault degrades to a typed error, not a crash

**Context.** The prompt asks what happens if the vault folder or a daily note is
missing. The app should not hard-crash on a missing file.

**Call.** Vault reads throw a typed `VaultFileNotFoundError` (carrying the path) on
ENOENT; all other errors propagate. Writes (`writeDailyNote`) `mkdir -p` the parent
first, so writing a note for a brand-new day always succeeds.

**Rationale.** A typed error lets the renderer show a graceful "no note yet, run
morning intake" state instead of an uncaught exception, while writes self-heal the
directory. The morning-intake flow (deferred) will create the day's note from the
template.

**Test for Jordan.** Run `npm test -- tests/vault.test.ts` (the "does not exist"
test). In the app, before any daily note exists, `getDailyNote` rejects with
VaultFileNotFoundError; confirm the eventual morning-intake view treats that as
"create from template," not an error toast.

**Consider adding.** Phase 2a: a `readDailyNoteOrCreate(date)` that materializes the
template when the note is absent.

---

## Decision: lastTouch is NOT bumped on source refresh

**Context.** Flagged in the prompt. Does `crmImport()` bump `lastTouch` when it
refreshes a SOURCE field on an existing contact?

**Call.** No. Import refreshes SOURCE fields only and leaves `lastTouch` (a STATE
field) exactly as it was. Only operator actions (the `crm*` mutators) bump it.

**Rationale.** A source refresh is a system event, not an operator touch. `lastTouch`
answers "when did I last work this contact," so a background roster refresh must not
move it. This matches the locked schema's "STATE fields are app-owned, import never
touches them."

**Test for Jordan.** `npm test -- tests/crm/import.test.ts` (the idempotency and
refresh tests assert STATE, including lastTouch via the unchanged record, survives
re-import). To eyeball it: import, note a contact's lastTouch, import again, confirm
it did not change.

**Consider adding.** Maybe: a separate `lastRefreshed` SOURCE-side timestamp if you
ever want to show "roster last synced" without conflating it with operator touch.

---

## Decision: the S-key is a no-op from a terminal state

**Context.** Flagged in the prompt. If a contact is `parked` (terminal) and the
operator cycles status (S-key), does it no-op, advance into research, or require an
explicit reset?

**Call.** No-op. `crmCycleStatus` on a terminal status returns the contact unchanged:
no status change, no history entry, no lastTouch bump, no write. Leaving a terminal
state is a deliberate act: `crmSetTerminal` (to a different terminal) or the new
`crmResetToLinear(id)` (back to research).

**Rationale.** The schema's whole reason for splitting linear vs terminal is that a
stray keypress must never silently move someone out of won/lost/parked. A true no-op
(not even a wasted write) is the safest reading.

**Test for Jordan.** `npm test -- tests/crm/status-cycle.test.ts` (the terminal no-op
and the `crmResetToLinear` tests). Decide if you would rather the S-key audibly
"refuse" (a UI affordance) vs silently doing nothing; the data layer is a no-op
either way.

**Consider adding.** Phase 2a: a distinct keystroke or confirm dialog for
`crmResetToLinear`, surfaced in the CRM popover.

---

## Decision: avatar is NOT inherited from the AVATAR-ROUTE tag on import

**Context.** Step 7c says "populate the structured avatar (for STATE if first
import)," but the merge rule, the hard constraints, and the acceptance criteria all
say `avatar=null` on import and "operator sets it via the A key." A direct conflict.

**Call.** Import sets `avatar=null`. The AVATAR-ROUTE parser still extracts an avatar
value (and the parser is tested on it), but import discards it and only lifts
`fraud_history` and `primary_route` (which are SOURCE fields) from the tag.

**Rationale.** When a spec contradicts itself, the locked schema and the hard
constraints win (the prompt says so explicitly). `avatar` is a STATE field, so the
operator owns it; the tag's routing is advisory, not authoritative.

**Test for Jordan.** `npm test -- tests/crm/import.test.ts` (asserts `pc.avatar` is
null after import even though its tag says `AVATAR: B`). If you actually want the tag
to seed avatar on first import, change `importFromSource` to copy `route.avatar` into
the new-contact branch only.

**Consider adding.** Maybe: surface the tag's suggested avatar as a dim "suggested: B"
hint in the popover so the operator can accept it with one keystroke.

---

## Decision: tier is derived from the "TIER N" notes marker

**Context.** The locked `CrmContact.tier` is a number, but the SOURCE roster has no
`tier` field; tier lives as prose ("TIER 1 ...") in notes and in history events.

**Call.** `parseTier` reads the first `TIER <n>` marker from the SOURCE notes and
stores it as the numeric `tier`. Missing marker => 0.

**Rationale.** It is the only machine-readable tier signal in the roster, and it is a
SOURCE field so deriving it at import (and refreshing it) is consistent with the
two-store model.

**Test for Jordan.** `npm test -- tests/crm/avatar-route-parse.test.ts` (parseTier
cases) and `import.test.ts` (asserts tier 1 and tier 3). If the roster ever gains a
real numeric `tier` field, prefer it over the prose marker in `sourceFieldsOf`.

**Consider adding.** Phase 2a: have the research pipeline emit a real `tier` field so
this derivation can retire.

---

## Decision: crmAddNote materializes top-level notes AND logs history

**Context.** Step 7d says crmAddNote "appends history kind note," while the mutations
test expects every mutator to update a top-level field. For a note, the natural
top-level field is `notes`.

**Call.** `crmAddNote` appends the prose to the top-level `notes` (newline-joined,
free prose) AND appends a `note` history entry with the prose as `detail`, then bumps
lastTouch. Reads see accumulated prose; history keeps the timestamped trail.

**Rationale.** Satisfies both the materialized-state principle (reads never replay
history) and the audit-log principle, without putting structured tags in `notes`.

**Test for Jordan.** `npm test -- tests/crm/mutations.test.ts` (asserts both the
`notes` field and the history entry). If you would rather notes be edited only via a
full-text editor (crmMutate id 'notes'), drop the `c.notes +=` line from crmAddNote.

**Consider adding.** Phase 2a: a notes editor in the popover bound to
`crmMutate(id, 'notes', ...)` for wholesale edits, with crmAddNote for quick appends.

---

## Decision: backups keep the last 50 prior-state snapshots

**Context.** Flagged in the prompt (suggested 50). How many timestamped backups to
keep, and do we snapshot the prior or the new state?

**Call.** Keep 50. Snapshot the PRIOR (pre-mutation) crm.json into
`backups/crm-<YYYY-MM-DDTHH-MM-SS-mmm>.json` BEFORE each atomic write, then prune to
the 50 most recent. Milliseconds are included in the stamp so rapid writes never
collide (a minor extension of the schema's to-the-second format).

**Rationale.** 50 covers a heavy day of edits without unbounded growth. Snapshotting
the prior state means every backup is a known-good rollback target; the schema's
"snapshot after rename" gives an equivalent chain, and "previous version" (Step 7d)
matches this choice.

**Test for Jordan.** `npm test -- tests/crm/atomic-write.test.ts` (asserts a backup is
written before a successful mutation). To verify retention, make 60 quick mutations
and confirm `~/GameOfLife/crm/backups/` holds 50 files. Change `keep` in
`snapshotBackup`/`persistStore` if you want more history.

**Consider adding.** Maybe: a daily-rollup backup (keep one per day beyond the last
50) for longer-horizon recovery.

---

## Decision: first launch ensures the store but does NOT auto-import

**Context.** Flagged in the prompt (suggested: auto-run import with a one-time
confirmation in the popover). The CRM popover UI is deferred tonight, so a real
confirmation prompt does not exist yet.

**Call.** On launch the app ensures `~/GameOfLife/crm/` and an empty
`crm.json` exist (and rebuilds the entity-link map), but it does NOT auto-run import.
The operator runs `window.gol.crmImport()` explicitly (from the popover, once its UI
lands, or from a Node REPL). `crmList` degrades to an empty array before the first
import.

**Rationale.** Auto-mutating data on launch without a real confirmation UI is riskier
than waiting for an explicit trigger. Ensuring the store exists is safe and keeps the
acceptance path ("run import at least once") one call away.

**Test for Jordan.** Launch the app, then run `await window.gol.crmImport()` once;
expect `{ added: 12, ... }` against the real roster and `crmList()` to return the
contacts. If you prefer auto-import, call `importFromSource()` in `bootstrap`
(src/main/index.ts) once the popover can show a confirmation first.

**Consider adding.** Phase 2c: a first-run confirmation card in the CRM popover that
calls crmImport and reports the counts.

---

## Decision: single write path, custom-stamped, source_removed flagged once

**Context.** The schema mandates a single writer for crm.json and a source_removed
flag for dropped contacts; both needed concrete behavior.

**Call.** All writes funnel through `persistStore` in `crm/persistence.ts` (the only
caller of the atomic writer for crm.json), used by both the mutation store and the
importer. A contact dropped from SOURCE is flagged `source_removed` once (guarded so
repeat imports do not spam history) and never deleted.

**Rationale.** A single funnel makes the single-writer guarantee enforceable by
inspection. One-time flagging keeps history meaningful across repeated imports.

**Test for Jordan.** `npm test -- tests/crm/import.test.ts` (the removed test asserts
one flag and that a second import adds zero removals). If a contact is later re-added
to SOURCE, it refreshes normally; the old source_removed entry remains as history.

**Consider adding.** Maybe: a paired `source_restored` entry if a previously removed
contact reappears in the roster.
