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
