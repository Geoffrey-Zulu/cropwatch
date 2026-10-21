# Upgrade Notes

Running log of the staged upgrade of this template. Each phase is a separate branch and PR,
branched from the previous phase.

| Phase | Branch                       | Scope                          |
| ----- | ---------------------------- | ------------------------------ |
| 0     | `chore/phase-0-housekeeping` | Line endings, notes scaffold   |
| 1     | `chore/phase-1-runtime`      | Node 24, pnpm 12               |
| 2     | `chore/phase-2-dependencies` | Dependency + security upgrades |
| 3     | `chore/phase-3-eslint`       | ESLint 10 flat config          |

Environment used for verification: Windows 11, Node v24.19.0.

---

## Phase 0 — Housekeeping

Branch: `chore/phase-0-housekeeping`

### What changed

- **Added `.gitattributes`** at the repo root:

  ```
  * text=auto eol=lf
  *.png binary
  *.svg text eol=lf
  ```

- **Re-checked out the working tree** so every text file is LF on disk
  (`git rm --cached -r . && git reset --hard`).
- **Added this file** (`UPGRADE-NOTES.md`).

### Problem this solves

`.prettierrc` sets `"endOfLine": "lf"`. On Windows clones with `core.autocrlf=true` the working
tree was CRLF while the index was LF, so `pnpm format:check` failed on **68 files** that had no
actual style drift — only line endings. Verified before the change: `git ls-files --eol` reported
90 files as `i/lf w/crlf`. After: all 91 text files are `i/lf w/lf`.

This failure was invisible in CI (Linux runners check out LF), so it only ever broke local runs
and only on Windows.

### Note on the renormalization commit

`git add --renormalize .` staged **zero** files, so there is no separate renormalization commit.
The index already stored LF for every file; only the working tree was CRLF. `.gitattributes` makes
the LF guarantee explicit and makes checkouts produce LF regardless of a contributor's
`core.autocrlf` setting. Nothing in any file's committed content changed in this phase.

### Verified not changed

`.gitignore` already covers `node_modules` (line 4), `dist` (9), `.turbo` (11) and `.env*`
(20–24, plus `*.local` on 25). Left untouched as instructed.

### Breaking changes encountered

None.

### Deferred

Nothing deferred in this phase.

### Gate 0 result

All checks run on `chore/phase-0-housekeeping`:

| Check                            | Result | Time |
| -------------------------------- | ------ | ---- |
| `pnpm install --frozen-lockfile` | pass   | 1.8s |
| `pnpm format:check`              | pass   | 2.0s |
| `pnpm lint`                      | pass   | 7.2s |
| `pnpm typecheck`                 | pass   | 4.7s |
| `pnpm build`                     | pass   | 6.1s |
| `pnpm test`                      | pass   | 6.4s |

`format:check` went from 68 failing files to 0.

---

## Phase 1 — Runtime and package manager

Branch: `chore/phase-1-runtime` (branched from `chore/phase-0-housekeeping`)

### What changed

| Item                    | Before          | After               |
| ----------------------- | --------------- | ------------------- |
| `engines.node`          | `>=20`          | `>=24`              |
| CI `node-version` pins  | `20`            | `24`                |
| `.nvmrc`                | absent          | `24`                |
| `packageManager`        | `pnpm@8.15.6`   | `pnpm@12.9.1`       |
| CI pnpm pins            | `8`             | `12`                |
| `lockfileVersion`       | `'6.0'`         | `'9.0'`             |
| `.npmrc`                | present         | deleted             |
| `pnpm.overrides`        | in package.json | pnpm-workspace.yaml |
| `dependency-review.yml` | present         | deleted             |

- Merged `origin/chore/upgrade-node-24` (3 commits), which bumped `engines.node` and every
  `actions/setup-node` pin from 20 to 24.
- Deleted `.github/workflows/dependency-review.yml`. It used `actions/dependency-review-action`,
  which requires GitHub Advanced Security; this repo is private and does not have GHAS, so the
  workflow could never run.
- Added an **Audit dependencies** step to `ci.yml` immediately after the install step:
  `pnpm audit --audit-level high`.

### pnpm 8 -> 12 breaking changes handled

Verified against the pnpm release notes and docs, then confirmed empirically against this repo.

1. **`pnpm.overrides` in `package.json` is no longer read (pnpm 11+), and fails silently.**
   This is the highest-risk item in the whole upgrade: all 15 security pins would have evaporated
   with no warning. Moved verbatim to the `overrides:` key in `pnpm-workspace.yaml`.
   Verified after install that every pin still resolves at or above its floor:

   | Pin               | Resolved         |
   | ----------------- | ---------------- |
   | `braces`          | 3.0.3            |
   | `cross-spawn`     | 7.0.6            |
   | `flatted`         | 3.4.4            |
   | `rollup`          | 4.64.0           |
   | `effect`          | 3.22.2           |
   | `vite`            | 5.4.21           |
   | `minimatch`       | 3.1.5 and 9.0.9  |
   | `brace-expansion` | 1.1.21 and 2.1.7 |
   | `ajv`             | 6.15.0           |
   | `js-yaml`         | 4.3.2            |
   | `yaml`            | 2.9.1            |
   | `picomatch`       | 2.3.2 and 4.0.7  |

2. **`.npmrc` is registry/auth only from pnpm 11.** Our `.npmrc` held only
   `auto-install-peers = true`, which has been the default since pnpm 8 and was already a no-op.
   Deleted the file rather than relocating a redundant setting.

3. **`onlyBuiltDependencies` was removed in pnpm 11.** pnpm 10 began blocking dependency lifecycle
   scripts by default and allowlisted them via `pnpm.onlyBuiltDependencies`; pnpm 11 removed that
   key and replaced it with `allowBuilds` in `pnpm-workspace.yaml`. Added the minimal allowlist:

   ```yaml
   allowBuilds:
     esbuild: true
   ```

   `esbuild` (via vite) is the only dependency in this tree that needs a build script. Confirmed
   by the install log (`esbuild postinstall: Done`) and by the absence of `ERR_PNPM_IGNORED_BUILDS`.
   `strictDepBuilds` defaults to `true` from pnpm 11, so an unlisted build would fail the install.

4. **Lockfile v6.0 cannot be migrated by pnpm 10 or later.** pnpm 10 removed the v6 -> v9
   conversion path, so pnpm 12 reported `Ignoring broken lockfile ... lockfileVersion of 6.0 is
incompatible` and performed a full fresh resolution. See "Consequences" below.

5. **pnpm 12 writes a two-document lockfile.** `pnpm-lock.yaml` now begins with `---` and contains
   an env document (`configDependencies`, `packageManagerDependencies`) followed by the project
   document. Both declare `lockfileVersion: '9.0'`. Third-party tooling that parses the lockfile
   with a single-document YAML parser will read zero dependencies. Turbo, our only lockfile-aware
   tool, was verified working (`pnpm build` passes and caches correctly).

6. **`pnpm version` now runs our `version` script**, because script names shadow built-in commands
   from pnpm 11. This happens to be what we want (the script calls `changeset version`). Use
   `pnpm pm version` if the built-in is ever needed.

7. **`minimumReleaseAge` defaults to 1440 minutes (24h) from pnpm 11**, so packages published in
   the last day will not resolve. Left at the default. If a release-day dependency ever needs to be
   picked up, set `minimumReleaseAge: 0` in `pnpm-workspace.yaml`.

### Consequences of the forced lockfile regeneration

Because the v6.0 lockfile could not be converted, every dependency was re-resolved from scratch
against the existing semver ranges. Declared ranges were **not** edited in this phase, but
caret-ranged packages moved to the newest version their range already allowed:

| Package           | Was    | Now     | Range            |
| ----------------- | ------ | ------- | ---------------- |
| `prettier`        | 3.2.5  | 3.9.9   | `^3.2.5`         |
| `turbo`           | 2.7.5  | 2.11.7  | `^2.7.5`         |
| `@changesets/cli` | 2.29.8 | 2.31.1  | `^2.27.1`        |
| `@trpc/*`         | 11.8.1 | 11.19.0 | `^11.0.0-rc.660` |

One formatting consequence: prettier 3.9.9 wraps interface `extends` clauses differently from
3.2.5, so `packages/ui/components/ui/button.tsx` was reformatted (whitespace only, no semantic
change) to keep `format:check` passing.

This also cut the advisory count substantially on its own, from **52** vulnerabilities
(3 low / 18 moderate / 28 high / 3 critical) to **12** (0 low / 7 moderate / 2 high / 3 critical).

### Expected failure: the new CI audit step

`pnpm audit --audit-level high` currently **exits 1**, so the CI workflow on this branch will fail
at the Audit dependencies step. This is expected and is why phases 1 and 2 must merge
back-to-back. The remaining high/critical advisories are:

| Package    | Severity | Cleared by                                   |
| ---------- | -------- | -------------------------------------------- |
| `vitest`   | critical | Phase 2 (vitest 2.1.9 -> 3.2.6+)             |
| `tinypool` | critical | Phase 2 (transitive of vitest)               |
| `vite`     | high     | Phase 2 (held at 5.4.21 by our own override) |
| `braces`   | high     | Phase 2 (under investigation)                |

### Deferred to Phase 2

- **`@trpc/*` 11.19.0 wants `typescript >=5.7.2`; we are pinned at `5.5.4`.** `pnpm peers check`
  reports this as an unmet peer in `apps/functions` and `apps/web`. It does not break typecheck,
  lint, build or test today. Phase 2 moves TypeScript to the latest 5.x, which satisfies it.
- Clearing the four high/critical advisories above.
- Removing the now-redundant `vite` override, which is actively holding vite at a vulnerable 5.x.

### Gate 1 result

`node --version` = `v24.19.0` (matches `.nvmrc` = 24).
`pnpm --version` = `12.9.1` (matches `packageManager` = `pnpm@12.9.1`).
`pnpm install --frozen-lockfile` from a deleted `node_modules`: **pass**, 4.9s.

| Check               | Result | Time  |
| ------------------- | ------ | ----- |
| `pnpm format:check` | pass   | 1.6s  |
| `pnpm lint`         | pass   | 3.4s  |
| `pnpm typecheck`    | pass   | 2.5s  |
| `pnpm build`        | pass   | 12.1s |
| `pnpm test`         | pass   | 3.5s  |
| `pnpm sync:lint`    | pass   | 1.5s  |

---

## Phase 2 — Dependencies and security

Branch: `chore/phase-2-dependencies` (branched from `chore/phase-1-runtime`)

> **Status: Gate 2 passes.** One high advisory has no fix available upstream and is a documented,
> deliberate risk acceptance with a removal condition — see "Accepted advisory: `braces`" below.

### What changed

Upgraded to latest:

| Package                     | Was     | Now    |
| --------------------------- | ------- | ------ |
| `turbo`                     | 2.7.5   | 2.11.7 |
| `vitest`                    | 2.1.9   | 5.0.3  |
| `@vitest/coverage-v8`       | absent  | 5.0.3  |
| `vite`                      | 5.4.21  | 8.3.3  |
| `@vitejs/plugin-react`      | 4.7.0   | 6.1.2  |
| `jsdom`                     | 25.0.1  | 30.1.2 |
| `@testing-library/react`    | 16.3.2  | 16.3.3 |
| `@testing-library/jest-dom` | 6.9.1   | 7.0.1  |
| `postcss`                   | 8.5.8   | 8.5.29 |
| `autoprefixer`              | 10.4.23 | 10.6.1 |
| `@changesets/cli`           | 2.31.1  | 3.0.3  |
| `syncpack`                  | 13.0.4  | 15.3.3 |
| `lint-staged`               | 15.5.2  | 17.6.0 |
| `husky`                     | 9.1.7   | 9.1.7  |
| `prettier`                  | 3.9.9   | 3.9.9  |

Held on their current majors, as agreed:

| Package              | Pinned at        | Latest  | Why                                                  |
| -------------------- | ---------------- | ------- | ---------------------------------------------------- |
| `react`, `react-dom` | 18.3.1           | 19.3.0  | framework major is a separate decision               |
| `@types/react(-dom)` | 18.3.31 / 18.3.7 | 19.3.0  | must track React 18                                  |
| `zod`                | 3.25.76          | 4.6.5   | framework major is a separate decision               |
| `tailwindcss`        | 3.4.19           | 4.3.3   | framework major is a separate decision               |
| `typescript`         | 5.9.3            | 7.0.2   | stays on 5.x; 5.9.3 is the latest 5.x                |
| `@trpc/*`            | 11.19.0          | 11.19.0 | latest stable 11.x                                   |
| `tailwind-merge`     | 2.6.1            | 3.7.0   | **v3 targets Tailwind 4**; v2 is the Tailwind 3 line |

Other changes:

- **`@trpc/*` declared ranges moved from `^11.0.0-rc.660` to `^11.19.0`.** The old range was a
  prerelease specifier that happened to resolve to stable builds.
- **`@vitest/coverage-v8` added** to `apps/functions`, `apps/web`, `packages/shared` and
  `packages/ui`. It was missing entirely, which is why `pnpm test:coverage` had never worked. Its
  version must match `vitest` exactly (it declares `vitest@5.0.3` as a peer).
- **`vite` added as an explicit devDependency** to `apps/functions`, `packages/shared` and
  `packages/ui`. vitest 5 declares vite as a peer rather than a dependency, so packages that run
  vitest now need it declared.
- **`engines.node` tightened from `>=24` to `>=24.15.0`**, the floor jsdom 30 requires
  (`^22.22.2 || ^24.15.0 || >=26`). `>=24` would have admitted 24.0–24.14, which jsdom rejects.
- **The entire `overrides` block was removed** from `pnpm-workspace.yaml` and **nothing was
  re-added**. The upgrades resolved every advisory those 15 pins had been covering. Removing them
  also unblocked vite, which the `vite: ^5.4.20` pin had been holding on a vulnerable 5.x.

### Breaking changes encountered and how they were handled

1. **syncpack 14 changed the config file format.** `lintFormatting`, `lintSemverRanges` and
   `lintVersions` were removed; the schema sets `additionalProperties: false`, so leaving them in
   is a hard error rather than an ignored key. Removed all three from `.syncpackrc.json`;
   `source` and `versionGroups` are unchanged. syncpack 14 also renamed `fix-mismatches` to `fix`,
   so the root `sync:fix` script is now `syncpack fix`. syncpack 15 additionally reads `overrides`
   from `pnpm-workspace.yaml` by default, which matches where Phase 1 moved them.

2. **`@testing-library/jest-dom` 7 broke typecheck across every test file.** The setup files
   imported the root entry point, which registers matchers at runtime but does not augment
   Vitest's `Assertion` type. Typecheck failed on all 22 uses of `toBeInTheDocument`,
   `toHaveTextContent` and `toHaveClass`. Fixed by importing the `/vitest` subpath in both setup
   files, which does both.

3. **vitest 5 + vite 8 broke the `test` block typing.** `apps/web/vite.config.ts` imported
   `defineConfig` from `vite`, which has no `test` property, so typecheck and build failed with
   `TS2769: No overload matches this call`. Fixed by importing `defineConfig` from `vitest/config`.

4. **vitest 5 could not resolve the root-absolute public asset imports.** `apps/web/src/App.tsx`
   did `import viteLogo from '/vite.svg'`, and `apps/web/src/App.test.tsx` failed with
   `TypeError: The argument 'filename' must be a file URL object, file URL string, or absolute
path string. Received 'file:///vite.svg'`. Files in `public/` are copied as-is and served from
   the site root, so there is no module to import and no dev server to resolve the path against
   under test. Changed to plain URL constants (`const viteLogo = '/vite.svg'`). The rendered
   `src` attribute is unchanged, so this is not a behaviour change. This is the only edit made
   under `apps/web/src`, and it was forced by the upgrade.

5. **lint-staged 17** raises its floor to Node >= 22.22.1 and requires Git >= 2.32.0, and made the
   `yaml` dependency optional. Our config lives in `package.json`, not YAML, and the tasks are
   plain binaries with no shell syntax, so no config change was needed. Verified working through
   the pre-commit hook on this phase's own commits.

6. **`@changesets/cli` 3** requires pnpm >= 10. Satisfied (12.9.1).

### Security result

Advisories went **12 -> 2** in this phase (and 52 -> 2 across phases 1 and 2):

| Phase         | info | low | moderate | high | critical |
| ------------- | ---- | --- | -------- | ---- | -------- |
| Before        | 0    | 3   | 18       | 28   | 3        |
| After Phase 1 | 0    | 0   | 7        | 2    | 3        |
| After Phase 2 | 0    | 0   | 1        | 1    | 0        |

Both critical advisories (`vitest`, `tinypool`) and the `vite` high are gone. What remains:

| Severity | Package                   | Advisory            | Patched versions | Reached via          |
| -------- | ------------------------- | ------------------- | ---------------- | -------------------- |
| high     | `braces`                  | GHSA-vfj7-8cjw-p6xm | **none**         | `tailwindcss@3.4.19` |
| moderate | `postcss-selector-parser` | —                   | `>=7.1.6`        | `tailwindcss@3.4.19` |

### Accepted advisory: `braces` (GHSA-vfj7-8cjw-p6xm)

**Accepted, with a removal condition.** Recorded in `pnpm-workspace.yaml`:

```yaml
auditConfig:
  ignoreGhsas:
    - GHSA-vfj7-8cjw-p6xm
```

**Why it is accepted:**

- **No patched release exists.** The advisory's patched range is `null`, and the latest published
  `braces` is 3.0.3 — itself the vulnerable version. There is nothing to upgrade or override to.
- **Build-time only.** `braces` is reached solely as a transitive devDependency, through
  `tailwindcss@3.4.19`'s glob stack (`micromatch`, `fast-glob`, `chokidar`). It is **not part of
  the production bundle**.
- **Not reachable by untrusted input here.** The DoS requires a maliciously deeply-nested glob
  pattern. The only patterns Tailwind expands in this repo are its own `content` globs over
  first-party source.

**Removal condition:** delete this ignore when Tailwind moves to 4.x, which drops the
`micromatch`/`chokidar` dependency chain. The same note is kept inline in `pnpm-workspace.yaml`
next to the entry so it is not lost.

**Scope of the suppression:** `ignoreGhsas` hides the advisory from `pnpm audit` entirely, not
just from the `--audit-level high` gate. Plain `pnpm audit` now reports `1 moderate` rather than
`1 moderate | 1 high`. This is the only entry in the list, so nothing else is being masked.

#### Original analysis

**Gate 2 requires 0 high and 0 critical. The high cannot be cleared by upgrading.**

- Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), "braces
  vulnerable to stack-exhaustion denial of service through deeply nested patterns".
- Vulnerable range: `<=3.0.3`. Patched versions: **`null`**. The latest published `braces` is
  **3.0.3**, which is itself vulnerable — **there is no fixed release to upgrade or override to.**
- Reached only through `tailwindcss@3.4.19`, via three paths
  (`tailwindcss > micromatch > braces`, `tailwindcss > fast-glob > micromatch > braces`,
  `tailwindcss > chokidar > braces`). A fourth path through `@typescript-eslint` 7 disappears in
  Phase 3, but the Tailwind paths remain.
- `braces` is a build-time devDependency. The DoS requires a maliciously deeply-nested glob
  pattern; in this repo the only patterns it sees are Tailwind's own `content` globs over
  first-party source. It is not shipped in the production bundle.

An override cannot fix this, so none was added. Three options were considered:

1. **Accept and suppress** via `auditConfig.ignoreGhsas` — documents the accepted risk in-repo and
   keeps the gate meaningful for everything else. **This is what was chosen.**
2. **Move `tailwindcss` to 4.x**, which drops the `micromatch`/`chokidar` globbing stack. Out of
   scope for this upgrade, and would also mean moving `tailwind-merge` to 3.x. This is the
   condition under which the ignore gets removed.
3. **Lower the CI gate** to `--audit-level critical`. Rejected: it would also stop catching future
   high advisories that _are_ fixable.

The same reasoning applies to the remaining moderate (`postcss-selector-parser`, patched
`>=7.1.6`): Tailwind 3.4.19 depends on `^6.1.2`, and forcing a major bump underneath it is more
likely to break the build than to help. It does not block the gate.

### Gate 2 result

| Check                            | Result   | Notes                                                            |
| -------------------------------- | -------- | ---------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | pass     | from deleted `node_modules`, 3.0s                                |
| `pnpm lint`                      | pass     | 4.9s                                                             |
| `pnpm typecheck`                 | pass     | 3.1s                                                             |
| `pnpm build`                     | pass     | 8.2s                                                             |
| `pnpm test`                      | pass     | 31 tests across 6 files                                          |
| `pnpm test:coverage`             | pass     | now runs to completion; 100% in all 4 packages                   |
| `pnpm sync:lint`                 | pass     | 0 mismatches                                                     |
| `pnpm format:check`              | pass     | 2.4s                                                             |
| `pnpm outdated`                  | expected | only the deliberately-held frameworks and Phase 3's ESLint stack |
| `pnpm audit --audit-level high`  | pass     | exit 0; 0 critical, 0 unaccepted high                            |

`pnpm outdated` remaining entries, all intentional: `react`, `react-dom`, `@types/react`,
`@types/react-dom`, `zod`, `tailwindcss`, `tailwind-merge`, `typescript` (held frameworks);
`eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`,
`eslint-config-prettier` (Phase 3's scope).

### Turborepo agent guidance disabled

Set `"agentGuidance": false` in `turbo.json`.

turbo 2.11.x writes an `AGENTS.md` block at the repo root whenever it detects an AI agent running
a repository-scoped command, and re-adds it on every subsequent run. In a template repo that means
an uncommitted file materialising in **every project cloned from this one**, on every agent run,
for anyone using an AI coding tool. Opting out keeps clones clean. Verified: after setting the
flag, `pnpm build` completes normally and no `AGENTS.md` is generated.

### Deferred

- **The `braces` ignore** (GHSA-vfj7-8cjw-p6xm) must be removed when Tailwind moves to 4.x, which
  drops the `micromatch`/`chokidar` dependency chain.
- **The remaining moderate** (`postcss-selector-parser`, patched `>=7.1.6`) is left in place.
  Tailwind 3.4.19 depends on `^6.1.2`, and forcing a major bump underneath it is more likely to
  break the build than to help. It stays visible in `pnpm audit` and does not block the gate.
- **Framework majors** - React 19, Zod 4, Tailwind 4, TypeScript 7 - remain a separate decision.

---

## Phase 3 — ESLint flat config

Branch: `chore/phase-3-eslint` (branched from `chore/phase-2-dependencies`)

### What changed

| Item                               | Before                           | After                         |
| ---------------------------------- | -------------------------------- | ----------------------------- |
| `eslint`                           | 8.57.1 (deprecated)              | 10.12.0                       |
| `@typescript-eslint/eslint-plugin` | 7.1.0                            | removed                       |
| `@typescript-eslint/parser`        | 7.1.0                            | removed                       |
| `typescript-eslint` (unified)      | absent                           | 8.71.1                        |
| `eslint-config-prettier`           | 9.1.2                            | 10.1.8                        |
| `eslint-plugin-react-hooks`        | absent                           | 7.1.1                         |
| `@eslint/js`                       | absent                           | 10.0.1                        |
| `globals`                          | absent                           | 17.13.0                       |
| Config format                      | 5 × `.eslintrc.cjs`              | 5 × flat config               |
| `@repo/eslint-config`              | CommonJS, single eslintrc object | ESM, `base` + `react` presets |

**ESLint's current major is 10, not 9.** ESLint 10 removed the eslintrc system entirely — there is
no `ESLINT_USE_FLAT_CONFIG` escape hatch — so this migration was mandatory rather than optional.

`typescript-eslint` 8.71.1 bundles the parser, plugin, utils and typescript-estree at one version,
so the two separately-versioned `@typescript-eslint/*` packages were dropped in its favour.

### The shared config package

`@repo/eslint-config` is now ESM (`"type": "module"`) and exports two presets through its
`exports` map:

- **`.` -> `base`** — `@eslint/js` recommended plus `typescript-eslint` recommended, with
  `eslint-config-prettier` last. Used by `apps/functions`, `packages/shared` and the repo root.
- **`./react` -> `react`** — `base` plus browser globals and `eslint-plugin-react-hooks`
  recommended rules, again with `eslint-config-prettier` last. Used by `apps/web` and
  `packages/ui`.

A third export, `core`, is the shared building block without `eslint-config-prettier`. It exists
so the React preset can add its own blocks _before_ prettier, which has to stay last in order to
switch off any formatting rules the earlier configs enable.

### Config file names

The repo root uses **`eslint.config.mjs`**; the four workspace packages use **`eslint.config.js`**.
The root `package.json` has no `"type": "module"`, so a root `eslint.config.js` would be parsed as
CommonJS and could not `import` the ESM shared config. The four workspace packages are already
`"type": "module"`, so plain `.js` works there. This is the one deviation from "five
`eslint.config.js` files", taken in preference to adding `"type": "module"` to the root package
purely to satisfy a filename.

### Breaking changes encountered and how they were handled

1. **The root config never resolved at all.** The old root `.eslintrc.cjs` did
   `extends: ["@repo/eslint-config/index.js"]` but the root `package.json` did not depend on
   `@repo/eslint-config`. Running ESLint from the root failed with
   `ESLint couldn't find the config "@repo/eslint-config/index.js" to extend from`. Fixed by adding
   `"@repo/eslint-config": "workspace:*"` to the root devDependencies.

2. **The eslintrc `env` key is gone in ESLint 10.** `env: { node: true }` is replaced by
   `languageOptions.globals` fed from the `globals` package — `globals.node` in `base`, plus
   `globals.browser` in the `react` preset.

3. **ESLint only lints `.js`/`.mjs`/`.cjs` by default**, plus whatever extensions a config names in
   `files`. A flat config that does not list the TypeScript extensions silently lints _nothing_ in
   a TypeScript project while still exiting 0. The shared config therefore sets
   `files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}']` explicitly. This was verified rather than
   assumed — see "Verification" below.

4. **`tseslint.config()` is deprecated** in favour of ESLint core's `defineConfig()` from
   `eslint/config`, which is what both presets use.

5. **`eslint-config-prettier` is imported from its `/flat` subpath**, which exports a single named
   config object rather than an array.

6. **`eslint-plugin-react-hooks` flat config lives under `configs.flat.*`.** The top-level
   `configs.recommended` still carries a legacy string-array `plugins` field and does not work with
   `defineConfig`. The presets use `reactHooks.configs.flat.recommended`.

7. **Config lookup changed in ESLint 10**: it now starts from each linted file's directory and
   stops at the first `eslint.config.*` it finds. Ancestor configs do **not** cascade. Each package
   therefore owns a complete config, and the root config governs root-level files only. This suits
   `turbo run lint`, which runs ESLint inside each package.

8. **Globs in a shared config resolve against the consuming config file**, not against the shared
   package. Every glob in `@repo/eslint-config` is `**`-prefixed so it makes no assumption about a
   consumer's layout.

9. **syncpack flagged the new `eslint` peer range.** `^10.0.0` as a peer against `^10.12.0`
   everywhere else is a `DiffersToHighestOrLowestSemver` mismatch. Set the peer to `^10.12.0`,
   matching the convention already used for the `react`/`react-dom` peers in `packages/ui`.

### Deliberate simplification: type-aware linting is off

Type-aware linting is **off in every package**. It was previously on in `packages/ui` only, via
`parserOptions: { project: true }`.

This is a deliberate choice, not an oversight. Enabling it in one package of five was an
inconsistency rather than a feature, and type-aware rules materially slow linting. No `project` or
`projectService` is set in `parserOptions`, and no `*TypeChecked` preset is extended, which is what
keeps it off. To turn it back on later, extend `tseslint.configs.recommendedTypeChecked` and set
`parserOptions.projectService: true`.

The single pre-existing rule override, `@typescript-eslint/no-non-null-assertion: off`, is kept.

### Lint scope

| Package           | Scope                                            |
| ----------------- | ------------------------------------------------ |
| `apps/functions`  | `src/**/*.{ts,tsx}`                              |
| `apps/web`        | `src/**/*.{ts,tsx}`                              |
| `packages/shared` | `src/**/*.{ts,tsx}`                              |
| `packages/ui`     | `components/**`, `lib/**`, `index.ts`, `test/**` |

`packages/ui` previously linted `**/*.{ts,tsx}`, which swept in its own config files. The others
were already scoped to `src/**` and are unchanged.

### lint-staged

Now runs `eslint --fix --no-warn-ignored` on staged `*.{ts,tsx}`. `--no-warn-ignored` suppresses
the `File ignored because of a matching ignore pattern` warning that ESLint emits when an ignored
file is passed explicitly, which lint-staged does by design. The rest of the config is unchanged;
nothing in lint-staged 17's format needed migrating.

### Verification

Because a flat config that fails to name the TypeScript extensions lints nothing while still
exiting 0, "lint passes" is not on its own evidence that linting works. Two deliberate errors were
introduced and confirmed to be caught, then removed:

| Probe                                                   | Expected rule                       | Result |
| ------------------------------------------------------- | ----------------------------------- | ------ |
| Unused local in a `.ts` file (`packages/shared`)        | `@typescript-eslint/no-unused-vars` | caught |
| Conditional `useState` in a `.tsx` file (`packages/ui`) | `react-hooks/rules-of-hooks`        | caught |

The pre-commit hook was exercised the same way:

| Probe                         | Expected behaviour                    | Result                    |
| ----------------------------- | ------------------------------------- | ------------------------- |
| Staged file with a lint error | commit blocked, working tree restored | blocked as expected       |
| Staged badly-formatted file   | commit succeeds, prettier rewrites it | reformatted in the commit |

Both probe commits were undone and the probe files deleted.

### Gate 3 result

Run cold, with `node_modules` deleted and every turbo cache cleared.

| Check                            | Result | Notes                                 |
| -------------------------------- | ------ | ------------------------------------- |
| `pnpm install --frozen-lockfile` | pass   | from deleted `node_modules`, 3.0s     |
| `pnpm lint` (from root)          | pass   | 5.1s, 6 turbo tasks                   |
| `pnpm lint` (in each package)    | pass   | functions, web, shared, ui all exit 0 |
| `pnpm typecheck`                 | pass   | 2.8s                                  |
| `pnpm build`                     | pass   | 3.9s                                  |
| `pnpm test`                      | pass   | 31 tests across 6 files               |
| `pnpm test:coverage`             | pass   | 100% in all 4 packages                |
| `pnpm format:check`              | pass   | 1.8s                                  |
| `pnpm sync:lint`                 | pass   | 0 mismatches                          |
| `pnpm audit --audit-level high`  | pass   | exit 0                                |
| `.eslintrc*` files remaining     | none   | verified by recursive search          |

### Deferred

- **Type-aware linting** stays off, as described above.
- **`eslint-plugin-react`** (as distinct from `react-hooks`) was not added; the brief specified
  react-hooks only.
- `packages/config` and `packages/typescript-config` still have no lint script and no ESLint
  config. Neither contains source code — `packages/config` holds a `tsconfig.json` and
  `packages/typescript-config` is unreferenced (see the Phase 0 audit notes).
