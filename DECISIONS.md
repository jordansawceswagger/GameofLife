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
