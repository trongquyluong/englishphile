# Security Phase 1D-C1 Report — Framework dependency remediation

Date: 2026-07-27

## Executive result

Security Phase 1D-C1 is implemented locally and remains unstaged and uncommitted on branch `security-phase-1d-c1-framework-dependencies`, based on `85af6d43dcfb15bc05689daf74d2e77002dcece7`.

The release-blocking framework paths in this phase are removed:

- direct `next@16.2.10` is now exact `next@16.2.12`;
- the nested `next > postcss@8.4.31` and shared build-chain `postcss@8.5.16` instances now resolve to one exact `postcss@8.5.18`; and
- the runtime image stack now resolves to exact `sharp@0.35.0` with libvips 8.18.3.

Next-only remediation was insufficient. Next 16.2.12 still declares exact `postcss@8.4.31` and optional `sharp@^0.34.5`, neither of which reaches the independent patched floors. This phase therefore makes PostCSS and Sharp explicit production dependencies and applies only a Next-scoped override that references those exact direct specifications.

Public-beta release remains blocked pending Phase 1D-C2 review and remediation of the remaining brace-expansion, ExcelJS, and UUID chains. H-11 remains **Partially remediated**. Preview and Production deployment/verification remain pending and are not claimed.

## Starting repository state

- Branch: `security-phase-1d-c1-framework-dependencies`
- HEAD/base: `85af6d43dcfb15bc05689daf74d2e77002dcece7`
- Tracked worktree: clean
- Index: clean
- Protected pre-existing untracked artifacts: `=` and prior `*.patch` review files; none was opened, modified, deleted, staged, or included

## Before inventory

`npm.cmd ls next postcss sharp --all` exited 0:

| Resolved package | Classification | Path |
| --- | --- | --- |
| `next@16.2.10` | Direct production framework/runtime | root; also satisfies optional peer `@vercel/analytics > next@>=13` |
| `postcss@8.4.31` | Transitive production/build-time | `next@16.2.10 > postcss@8.4.31` |
| `postcss@8.5.16` | Transitive development/build-time | `@tailwindcss/postcss@4.3.2 > postcss@^8.5.15` and `vitest@4.1.10 > vite@8.1.4 > postcss@^8.5.16` |
| `sharp@0.34.5` | Optional transitive production runtime | `next@16.2.10 > sharp@^0.34.5`; installed and used by the Next image optimizer |

The application has three tracked `next/image` consumers: `FounderPortrait`, `EnglishphileLogo`, and `BrandMark`.

## Current primary advisory metadata

The 2026-07-27 npm registry/audit result retained the same advisory set, patched floors, and vulnerable-package-entry counts recorded on 2026-07-26. Current npm dist-tags are Next 16.2.12, PostCSS 8.5.23, and Sharp 0.35.3. This phase deliberately uses the smallest exact versions that satisfy the recorded floors: PostCSS 8.5.18 and Sharp 0.35.0. The Sharp advisory recommends the current latest release but still records 0.35.0 as the patched floor.

Audit totals are vulnerable dependency-package entries, not independent GHSA counts.

### Next

All nine Next-native advisories affect 16.2.10 and are patched for the 16.2 line at 16.2.11:

| Advisory | Severity | Patched 16.2 floor |
| --- | --- | --- |
| `GHSA-6gpp-xcg3-4w24` | High | 16.2.11 |
| `GHSA-m99w-x7hq-7vfj` | High | 16.2.11 |
| `GHSA-89xv-2m56-2m9x` | High | 16.2.11 |
| `GHSA-p9j2-gv94-2wf4` | High | 16.2.11 |
| `GHSA-68g3-v927-f742` | Moderate | 16.2.11 |
| `GHSA-4633-3j49-mh5q` | Moderate | 16.2.11 |
| `GHSA-4c39-4ccg-62r3` | Moderate | 16.2.11 |
| `GHSA-q8wf-6r8g-63ch` | Moderate | 16.2.11 |
| `GHSA-955p-x3mx-jcvp` | Moderate | 16.2.11 |

Before mutation, npm proposed forced installation of `next@16.2.12` because it was outside the exact root pin. No audit fix or force option was used.

### PostCSS

| Advisory | Severity | Patched floor |
| --- | --- | --- |
| `GHSA-qx2v-qp2m-jg93` | Moderate | 8.5.10 |
| `GHSA-6g55-p6wh-862q` | High | 8.5.12 |
| `GHSA-r28c-9q8g-f849` | High | 8.5.18 |

The aggregate safe floor is therefore 8.5.18. Before mutation, both 8.4.31 and 8.5.16 were affected.

### Sharp

`GHSA-f88m-g3jw-g9cj` is High severity, covers inherited libvips issues CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, and CVE-2026-35591, affects Sharp below 0.35.0, and is patched at 0.35.0.

## Candidate and compatibility

The exact manifest candidate is:

```json
{
  "dependencies": {
    "next": "16.2.12",
    "postcss": "8.5.18",
    "sharp": "0.35.0"
  },
  "overrides": {
    "next": {
      "postcss": "$postcss",
      "sharp": "$sharp"
    }
  }
}
```

This is not a global override:

- Next alone is redirected to the reviewed exact PostCSS and Sharp specifications.
- `@tailwindcss/postcss@4.3.2` declares `postcss@^8.5.15`, and `vite@8.1.4` declares `postcss@^8.5.16`; both naturally accept and deduplicate to 8.5.18.
- Next uses public PostCSS 8 APIs for plugin construction and `process()` operations. PostCSS 8.5.18 preserves those APIs and the Node engine remains compatible.
- Sharp 0.35.0 is a breaking pre-1.0 release and was therefore reviewed rather than presumed compatible. Next 16.2.12 uses the retained Sharp constructor, `concurrency`, `metadata`, `timeout`, `rotate`, `resize`, PNG/JPEG/WebP/AVIF encoders, and `toBuffer`. It does not use the 0.35.0 removed `failOnError`, `paletteBitDepth`, deprecated sharpen properties, or `format.jp2k` interfaces.
- Next 16.2.12 and Sharp 0.35.0 both require Node 20.9 or newer. Local verification used Node 24.14.1.

## Install and lockfile evidence

Normal `npm.cmd install` exited 0. It added one package, removed one package, and changed six installed packages. It emitted no peer-dependency, invalid-tree, deduplication, optional-binary, or platform warning.

`npm.cmd ls next postcss sharp --all` exits 0 after installation:

| Package | After path |
| --- | --- |
| `next@16.2.12` | exact direct production dependency; deduped peer for Vercel Analytics |
| `postcss@8.5.18` | exact direct production dependency; deduped for Next, Tailwind PostCSS, and Vite |
| `sharp@0.35.0` | exact direct production runtime dependency; deduped for Next's overridden optional dependency |

The lockfile preserves registry integrity and changes only the intended dependency families:

- root dependency records add exact PostCSS and Sharp and update exact Next;
- Next, `@next/env`, and every optional `@next/swc-*` package move from 16.2.10 to 16.2.12;
- `node_modules/next/node_modules/postcss@8.4.31` is removed;
- root PostCSS moves from 8.5.16 to 8.5.18 and becomes production-reachable;
- Sharp moves from 0.34.5 to 0.35.0, its platform packages move to 0.35.0, and its libvips packages move from 1.2.4 to 1.3.0;
- Sharp 0.35's FreeBSD/WebAssembly and WebContainers entries are added, while optional/dev reachability flags are recalculated because Sharp is now direct production;
- no unrelated package version and no unrelated direct dependency changed.

Exact primary package integrities:

| Package | Lockfile integrity |
| --- | --- |
| `next@16.2.12` | `sha512-iD59eYQWmbFcEbX7v/acG5DRym9iw1DdaPoD0WTA920naWsE25wShzJW4+UvAs8MK9EC2kBfIH6vtto1H1PHGw==` |
| `postcss@8.5.18` | `sha512-xdB1oSLHbz1vRWgCDalrCqEFTWzFlhqFC5tIHLMOSUIjhm3XXQ1qrFy8S/ESr1JYRRXqM3c1QFiMZUJdUTqyMQ==` |
| `sharp@0.35.0` | `sha512-BqvG5XbwPZ4NV0DK90d86leEECMsoa8bO0nqnKWlBDYxri4GJ7c4EDInaF6q20lTh/mATmnDIKWJFfXnoVfH5g==` |

## Dependency runtime probes

One composite dependency runtime probe used only synthetic in-memory data and a disposable directory under the operating-system temp area:

1. loaded the Next module and asserted version 16.2.12;
2. loaded PostCSS 8.5.18 and ran a real plugin parse/process transformation;
3. created a synthetic safe input directory and a synthetic invalid map one directory above it, processed a `sourceMappingURL=../outside.map` annotation, and confirmed PostCSS completed without reading/disclosing it and removed the unsafe annotation;
4. loaded Sharp 0.35.0/libvips 8.18.3, read metadata for a 2×2 four-channel in-memory raw image, resized it to 1×1, and encoded it as PNG;
5. passed that PNG through Next's production `optimizeImage` helper and confirmed valid 1×1 PNG metadata; and
6. removed the temporary directory and confirmed its absence.

The first draft probe expected PostCSS to preserve the rejected annotation and failed that assertion. Inspection of synthetic output showed the secure behavior removes it. A second combined probe reached successful Sharp processing but used the now-unexported `sharp/package.json` only for evidence formatting. The final probe used Sharp's supported `sharp.versions.sharp` property and passed. Neither intermediate failure indicates a dependency runtime incompatibility.

## Application and build evidence

Focused tests passed: 15 files and 141 tests covering framework-adjacent Server Actions, admin preview, import commit and atomicity, practice/random submission, diagnostic actions/results/security, contest authorization/storage, and Writing/submission bounds.

Full local verification:

| Command | Result |
| --- | --- |
| `npx.cmd prisma validate` | Exit 0; schema valid |
| `npx.cmd prisma generate` | Exit 0; Prisma Client 6.19.3 generated |
| `npm.cmd run typecheck` | Exit 0 |
| `npm.cmd run lint` | Exit 0 |
| Dependency runtime probe | Exit 0 |
| Focused Vitest set | Exit 0; 15 files, 141 tests |
| `npm.cmd test` | Exit 0; 41 files, 459 passed, 8 skipped |
| `npm.cmd run build` | Exit 0; Next 16.2.12/Turbopack compiled and generated 63 pages |
| `npm.cmd audit` | Exit 1; 17 vulnerable-package entries remain: 1 Moderate, 16 High |
| `npm.cmd audit --omit=dev` | Exit 1; 10 vulnerable-package entries remain: 1 Moderate, 9 High |
| `git diff --check` | Exit 0 |

The authoritative Prisma, test, and build runs temporarily held standard dotenv files by pathname without opening them, supplied explicit synthetic configuration, disabled the opt-in PostgreSQL integration target, and restored the files in `finally`. The build used an intentionally invalid synthetic database target so Prisma configuration failed before any network or database connection. Its two fixed generic `Database operation failed` classifications contained no raw provider error. No real database, endpoint, browser, provider, deployment, or existing environment value was used by the authoritative verification.

An earlier Prisma validate/generate invocation reported that Prisma had automatically loaded `.env` before the stricter hold wrapper was added. It printed no value, explicit synthetic database variables already had precedence, and it made no database connection. That invocation is not used as the environment-isolated evidence; the same commands were rerun successfully with dotenv files held by pathname. No environment value was inspected or printed.

All three existing `next/image` components typechecked and compiled in the successful production build. The direct Next image-optimizer helper also passed the in-memory Sharp probe.

## Evidence classification

| Evidence class | Phase 1D-C1 result |
| --- | --- |
| Production runtime/helper tests | Focused route/component/helper tests and the complete default suite passed |
| Simulations/mocked collaborator tests | Included in focused and full Vitest results; retained as simulation/unit evidence, not Production evidence |
| Static checks | TypeScript, ESLint, existing static security tests, lock/tree inspection, and `git diff --check`; static evidence is not relabeled as runtime evidence |
| Isolated PGlite integration tests | Zero run in this phase; eight opt-in integration cases were skipped by the default suite |
| Dependency runtime probes | One final composite probe passed for Next, PostCSS, Sharp, and Next image optimization |
| Real managed PostgreSQL tests | Zero |
| Preview/Production/provider tests | Zero; still pending |

## Final audit and remaining Phase 1D-C2 work

The Next, PostCSS, and Sharp audit objects and all 13 associated in-scope GHSAs are absent after remediation.

The remaining audit output is intentionally unchanged by this phase:

- `GHSA-3jxr-9vmj-r5cp` and `GHSA-mh99-v99m-4gvg` through brace-expansion/minimatch/glob and the ExcelJS/archiver chain; full scope also includes ESLint-related consumers; and
- `GHSA-w5hq-g745-h8pq` through `exceljs > uuid@8.3.2`.

Npm proposes breaking forced changes (`eslint@10.8.0` in full scope and `exceljs@3.4.0` for the production chain). Phase 1D-C1 does not accept or implement those proposals. Brace-expansion, UUID, and the ExcelJS chain remain explicitly assigned to Phase 1D-C2.

## Safety and disposition

- No `npm audit fix`, `--force`, or `--legacy-peer-deps` command was used.
- No application behavior, Prisma schema, migration, script, or runtime configuration file changed.
- No migration, seed, import, export, backup, cleanup, or data rewrite ran.
- No real database, endpoint, browser, provider, deployment, or environment value was used by the authoritative verification; the initial Prisma dotenv auto-load exception is disclosed above.
- No file was staged, committed, pushed, deployed, merged, or used to change PR state.
- Preview and Production compatibility remain pending.
- Public beta remains blocked on the actual remaining Phase 1D-C2 dependency findings.
- H-11 remains **Partially remediated**.
