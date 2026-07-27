# Security Phase 1D-C2 Report — Transitive dependency remediation

Date: 2026-07-27

## Executive result

Security Phase 1D-C2 removes every production dependency advisory remaining after Phase 1D-C1. The final production audit exits 0 with zero vulnerable package entries. The full audit exits 1 with one High vulnerable package entry, `brace-expansion@1.1.15`, representing two GHSAs on a development-only ESLint/minimatch path. Repository and dependency-tree evidence establishes that this remaining instance is absent from production installation and is not reachable from an application request.

The selected remediation keeps `exceljs@4.4.0`, `archiver@5.3.2`, and `zip-stream@4.1.1`, where a forced parent major upgrade was proven incompatible with ExcelJS streaming output. It uses parent- or consumer-scoped overrides for `unzipper@0.12.5`, `uuid@11.1.1`, `readdir-glob@3.0.0`, `archiver-utils > glob@13.0.6`, and `minimatch@10.2.5 > brace-expansion@5.0.8`.

Real ExcelJS round-trip testing exposed an existing adapter defect: ExcelJS returns numeric `row.values` arrays and `{ formula, result }` formula objects, while the parser read only letter-keyed legacy shapes. The parser now accepts both representations and rejects ExcelJS formula objects. A build-only incompatibility in `unzipper@0.12.5` was also independently verified: Turbopack tried to resolve its optional S3 integration. `serverExternalPackages: ["exceljs"]` now keeps this Node-only server dependency external, as documented by Next.

Phase 1D-C2 clears the dependency-advisory condition for public beta. It does not grant a blanket release approval for unrelated findings or operational gates. H-11 remains **Partially remediated**; this phase does not close or expand H-11.

The repository chronology is explicit: the Phase 1D-C2 dependency implementation is commit `7e582904c392a743dc8a0e62c5d18f4d494efd19`, followed by the formula-validation UI correction in commit `a743e3a18c1fab825f07d6ae81b8de87bdc461c5`. During the supplied Preview verification, PR #16 remained OPEN and Draft, was MERGEABLE, and targeted `main`. Production functional verification and merge have not occurred.

## Starting checkpoint and safety boundary

- Branch: `security-phase-1d-c2-transitive-dependencies`
- Full HEAD/base: `0cae690f1a66ea2089bc7de847bc27ee023bb461`
- Tracked worktree before mutation: clean
- Index before mutation: clean
- Node: `v24.14.1`
- npm: `11.11.0`
- Protected pre-existing untracked files were inventoried by filename only. The file named `=` and every pre-existing `*.patch` review artifact were not read, modified, deleted, staged, or included.
- No Preview, Production, browser, Vercel, Neon, GitHub, provider, deployed endpoint, real database, or environment value was accessed.
- No migration, seed, import, export, backup, cleanup, historical rewrite, or data rewrite was run.
- No `npm audit fix`, forced audit fix, stage, commit, push, deployment, merge, PR creation, or PR-state change was performed.

## Original dependency and advisory state

The baseline `npm ls --all` and every requested `npm explain` command exited 0. The full audit exited 1 with 17 vulnerable package entries: 1 Moderate and 16 High. The production audit exited 1 with 10 vulnerable package entries: 1 Moderate and 9 High. These are propagated vulnerable-package objects, not independent advisories. The three unique advisory records were `GHSA-3jxr-9vmj-r5cp`, `GHSA-mh99-v99m-4gvg`, and `GHSA-w5hq-g745-h8pq`.

### Original production tree

```text
exceljs@4.4.0 (direct production)
├─ archiver@5.3.2
│  ├─ archiver-utils@2.1.0
│  │  └─ glob@7.2.3
│  │     └─ minimatch@3.1.5
│  │        └─ brace-expansion@1.1.15
│  ├─ readdir-glob@1.1.3
│  │  └─ minimatch@5.1.9
│  │     └─ brace-expansion@2.1.2
│  └─ zip-stream@4.1.1
│     └─ archiver-utils@3.0.4
│        └─ glob@7.2.3
│           └─ minimatch@3.1.5
│              └─ brace-expansion@1.1.15
├─ unzipper@0.10.14
│  └─ fstream@1.0.12
│     └─ rimraf@2.7.1
│        └─ glob@7.2.3
│           └─ minimatch@3.1.5
│              └─ brace-expansion@1.1.15
└─ uuid@8.3.2
```

The ten production audit objects were `archiver`, `archiver-utils`, `brace-expansion`, `exceljs`, `glob`, `minimatch`, `readdir-glob`, `rimraf`, `uuid`, and `zip-stream`.

### Original development tree

```text
eslint-config-next@16.2.10
├─ eslint-plugin-import@2.32.0 ─┐
├─ eslint-plugin-jsx-a11y@6.10.2 ├─ minimatch@3.1.5
└─ eslint-plugin-react@7.37.5 ──┘  └─ brace-expansion@1.1.15

eslint@9.39.4
├─ @eslint/config-array@0.21.2 ─┐
├─ @eslint/eslintrc@3.3.5 ──────┼─ minimatch@3.1.5
└─ minimatch@3.1.5 ──────────────┘  └─ brace-expansion@1.1.15

eslint-config-next@16.2.10
└─ typescript-eslint@8.62.1
   └─ @typescript-eslint/typescript-estree@8.62.1
      └─ minimatch@10.2.5
         └─ brace-expansion@5.0.7
```

The additional full-audit propagation objects were `@eslint/config-array`, `@eslint/eslintrc`, `eslint`, `eslint-config-next`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react`.

## Current primary metadata

Metadata was checked against the npm registry and official GitHub advisory records on 2026-07-27. The audit returned no additional current advisory beyond the three listed here.

| Advisory | Affected ranges | Patched versions relevant here | Result |
| --- | --- | --- | --- |
| [`GHSA-3jxr-9vmj-r5cp`](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | `<1.1.16`, `>=2.0.0 <2.1.2`, `>=3.0.0 <5.0.7` | 1.1.16, 2.1.2, 5.0.7 | Production consumers use 5.0.8; development 1.1.15 remains |
| [`GHSA-mh99-v99m-4gvg`](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | `<=5.0.7` | 5.0.8 only | Production consumers use 5.0.8; development 1.1.15 remains |
| [`GHSA-w5hq-g745-h8pq`](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | `<11.1.1`, `>=12 <12.0.1`, `>=13 <13.0.1` | 11.1.1, 12.0.1, 13.0.1 | ExcelJS-scoped UUID is 11.1.1 |

`GHSA-3jxr-9vmj-r5cp` is an exponential CPU denial of service involving consecutive non-expanding brace groups. `GHSA-mh99-v99m-4gvg` is unbounded output expansion leading to memory exhaustion. `GHSA-w5hq-g745-h8pq` requires the UUID v3, v5, or v6 APIs with an externally supplied buffer and offset. ExcelJS uses the CommonJS `v4()` export without a caller buffer for conditional-formatting IDs.

Current registry facts used for compatibility:

| Package | Relevant/current tag | Engine requirement |
| --- | --- | --- |
| `brace-expansion` | latest `5.0.8`; maintenance v1 `1.1.16`; maintenance v2 `2.1.2` | 5.0.8: Node `20 || >=22` |
| `minimatch` | latest/10 `10.2.5`; legacy 3 `3.1.5`; legacy 5 `5.1.9` | 10.2.5: Node `18 || 20 || >=22` |
| `glob` | latest `13.0.6`; legacy 10 `10.5.0` | 13.0.6: Node `18 || 20 || >=22` |
| `exceljs` | stable/latest `4.4.0`; prerelease `4.4.1` | 4.4.0: Node `>=8.3` |
| `archiver` | latest `8.0.0`; compatible CJS line `7.0.1` | 7.0.1: Node `>=14`; 8.0.0: Node `>=18` |
| `archiver-utils` | latest `5.0.2` | Node `>=14` |
| `zip-stream` | latest `7.0.5` | Node `>=18` |
| `readdir-glob` | latest `3.0.0` | Node `>=18` |
| `unzipper` | latest `0.12.5` | no package engine declaration |
| `uuid` | latest `14.0.1`; patched CommonJS line `11.1.1` | 11.1.1 has no package engine declaration |

The selected production overrides are compatible with Node 24.14.1. The project already requires a modern Node version for Next 16.2.12. The npm-suggested ExcelJS remediation was not accepted: it proposed a breaking downgrade to `exceljs@3.4.0`, did not represent a current parent upgrade, and retained an older archive dependency family.

## Repository reachability

### Workbook parsing and contest import

- The only tracked ExcelJS import is the dynamic server import in `src/lib/import/excel-contest-parser.ts`.
- Production reachability is `/api/admin/contests-import/parse`.
- `requireContentAdminApi` runs before file access. The caller must be a stored `ADMIN` or owner-equivalent principal; anonymous and ordinary learner callers are rejected.
- The route enforces same-origin handling and a database-backed rate limit of 10 parses per administrator per hour.
- Only `.xlsx` is accepted. The route rejects files above 2 MiB before and after `arrayBuffer()`, validates the ZIP `PK` signature, and returns generic Vietnamese errors.
- After ExcelJS load, the parser caps 8 worksheets, 30 sections, 500 questions, 1,000 rows per sheet, 20,000 question cells, and 20,000 characters per question cell. ExcelJS decompression necessarily occurs before post-load worksheet/row checks, but the compressed upload is bounded at 2 MiB.
- Formula cells are rejected. Phase 1D-C2 extended this check to ExcelJS’s actual `{ formula, result }` and shared-formula representations.
- The route logs only fixed `safeErrorSignal` classifications. Focused tests prove raw dependency errors are absent from the response and log calls.
- Input is administrator-controlled, not learner-controlled. The path executes in Production.

### Archive, glob, brace, and UUID paths

- There is no tracked application import of `archiver`, `archiver-utils`, `zip-stream`, `readdir-glob`, `glob`, `minimatch`, `brace-expansion`, or `uuid`.
- The route’s normal `workbook.xlsx.load()` path uses ExcelJS/JSZip. ExcelJS’s `unzipper` dependency is used by its streaming workbook reader, which Englishphile does not call.
- ExcelJS’s Archiver path is its streaming workbook writer, which Englishphile does not call. It was still exercised because a parent override must not break other public behavior of the direct production package.
- No tracked application route generates or extracts a standalone ZIP archive. README ZIP upload is future/TODO text, not an active route. XLSX is itself a ZIP container and remains administrator-controlled and size-bounded.
- No untrusted caller pattern is passed to Glob, Minimatch, or brace-expansion. The affected production packages were dependency implementation details, not request-pattern APIs.
- ExcelJS invokes `uuid.v4()` only for conditional-formatting extension identifiers. No external UUID buffer/offset is supplied, and these identifiers are neither credentials nor authorization/session identifiers.
- PostgreSQL-generated application UUIDs are unrelated to ExcelJS’s UUID dependency.

## Candidates considered

All practical candidates were first built in disposable package/lockfile experiments.

1. A global `brace-expansion@5.0.8` override made audit green but was rejected. Minimatch 3 expects brace-expansion’s historical callable CommonJS API; brace-expansion 5 exports an object and produced `TypeError: expand is not a function`.
2. `exceljs > archiver@7.0.1` plus patched UUID was rejected because nine production audit objects remained through archive subconsumers.
3. Archiver 7 plus `readdir-glob@3`, `glob@13`, `unzipper@0.12.5`, and UUID 11 was first rejected in a nesting form that retained five production findings.
4. A fully resolved Archiver 7 candidate reached zero production findings but was rejected by runtime evidence: ExcelJS’s streaming writer failed with `ArchiverError: input source must be valid Stream or Buffer`. A major parent override was therefore not safe.
5. The selected candidate keeps the compatible ExcelJS/Archiver/ZipStream parents and replaces only vulnerable leaves or dedicated subconsumers.

One early disposable streaming test used an incorrect `StreamBuf.read()` loop and exhausted its test process; ExcelJS returns an empty buffer rather than `null` there. The corrected compatibility probe uses an explicit stream/collected buffer. This harness error was not treated as dependency evidence.

## Selected remediation

The exact `package.json` addition is:

```json
{
  "overrides": {
    "exceljs": {
      "unzipper": "0.12.5",
      "uuid": "11.1.1"
    },
    "readdir-glob": "3.0.0",
    "archiver-utils": {
      "glob": "13.0.6"
    },
    "minimatch@10.2.5": {
      "brace-expansion": "5.0.8"
    }
  }
}
```

No direct dependency changed. `next@16.2.12`, `postcss@8.5.18`, `sharp@0.35.0`, and `eslint-config-next@16.2.10` remain unchanged.

`next.config.ts` adds:

```ts
serverExternalPackages: ["exceljs"]
```

The first build proved why this is necessary: `unzipper@0.12.5` intentionally leaves `@aws-sdk/client-s3` optional, while Turbopack statically followed its `require`. Next’s official [`serverExternalPackages` documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages) specifies externalization for Node-specific Route Handler dependencies, and the [Next 16.1 release notes](https://nextjs.org/blog/next-16-1) document corrected transitive externalization in Turbopack. The upstream [`unzipper` issue](https://github.com/ZJONSSON/node-unzipper/issues/330) confirms that the S3 SDK is optional and should not be installed for consumers that do not use S3. Englishphile uses neither S3 nor the ExcelJS streaming reader.

## Complete lockfile explanation

The lockfile retains registry URLs and integrity hashes. Important selected-package integrities are:

| Package | Integrity |
| --- | --- |
| `brace-expansion@5.0.8` | `sha512-JZyDyq3D4AUifKTPOB7DELf6XsB3WdPuNxCtob1vFXPsSXhdAiHBWJ/tJ8HAc9aH84BK+5JFZLNkJKx3G9kzQg==` |
| `minimatch@10.2.5` | `sha512-MULkVLfKGYDFYejP07QOurDLLQpcjk7Fw+7jXS2R2czRQzR56yHRveU5NDJEOviH+hETZKSkIk5c+T23GjFUMg==` |
| `glob@13.0.6` | `sha512-Wjlyrolmm8uDpm/ogGyXZXb1Z+Ca2B8NbJwqBVg0axK9GbBeoS7yGV6vjXnYdGm6X53iehEuxxbyiKp8QmN4Vw==` |
| `readdir-glob@3.0.0` | `sha512-AhNB2KgKeVJr16nK9LLZbJNWnYoT23ZrumNKFDebHBdkC8KHSqWo871JAUhoWC/RtjEVdqNMFpM6qrwRbaUqpw==` |
| `unzipper@0.12.5` | `sha512-tXYOi9R57Uj/2Z25SOs5RRSzq886MBQj2gY8dPL+xl/kv6s6SvByoKfAtvfVeEuhntWDgjd2o9p2lb4TVPAz0A==` |
| `uuid@11.1.1` | `sha512-vIYxrBCC/N/K+Js3qSN88go7kIfNPssr/hHCesKCQNAjmgvYS2oqr69kIufEG+O4+PfezOH4EbIeHCfFov8ZgQ==` |

Every package-record change is accounted for:

- `@typescript-eslint/typescript-estree`’s brace-expansion moves 5.0.7 → 5.0.8.
- Root `balanced-match`, `brace-expansion@1.1.15`, `concat-map`, `minimatch@3.1.5`, and `minimist` become development-only because no production consumer remains.
- `bluebird` moves 3.4.7 → 3.7.2 with Unzipper.
- `glob` moves 7.2.3 → 13.0.6 and gains its nested `balanced-match@4.0.4`, `brace-expansion@5.0.8`, `minimatch@10.2.5`, `minipass@7.1.3`, `path-scurry@2.0.2`, and nested `lru-cache@11.5.2`.
- `readdir-glob` moves 1.1.3 → 3.0.0; its nested brace-expansion moves 2.1.2 → 5.0.8, its Minimatch moves 5.1.9 → 10.2.5, and `balanced-match@4.0.4` is added.
- `unzipper` moves 0.10.14 → 0.12.5 and adds `fs-extra@11.3.1`, `jsonfile@6.2.1`, `node-int64@0.4.0`, and `universalify@2.0.1`.
- `uuid` moves 8.3.2 → 11.1.1.
- Obsolete Unzipper/archive-chain packages are removed: `big-integer`, `binary`, `buffer-indexof-polyfill`, `buffers`, `chainsaw`, `fs.realpath`, `fstream`, `inflight`, `listenercount`, `mkdirp@0.5.6`, `path-is-absolute`, `rimraf@2.7.1`, `traverse`, and Unzipper’s nested `isarray`, `readable-stream@2`, `safe-buffer`, and `string_decoder`.
- No unrelated direct dependency or unrelated package version changed.

`npm ci --ignore-scripts` exits 0. `npm ls --all` exits 0 with no invalid or missing entries. npm 11’s JSON `problems` array contains the same six pre-existing platform-optional WASM artifacts seen at the starting checkpoint (`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@img/sharp-wasm32`, `@napi-rs/wasm-runtime`, and `@tybys/wasm-util`) as “extraneous”; neither `npm prune` nor `--omit=optional` removes that npm/Sharp platform artifact state. Phase 1D-C2 does not change Sharp or those versions, and it does not misrepresent this baseline limitation as a clean zero-problem JSON tree.

## Final dependency tree

```text
exceljs@4.4.0
├─ archiver@5.3.2
│  ├─ archiver-utils@2.1.0
│  │  └─ glob@13.0.6
│  │     └─ minimatch@10.2.5
│  │        └─ brace-expansion@5.0.8
│  ├─ readdir-glob@3.0.0
│  │  └─ minimatch@10.2.5
│  │     └─ brace-expansion@5.0.8
│  └─ zip-stream@4.1.1
│     └─ archiver-utils@3.0.4
│        └─ glob@13.0.6 (deduped)
├─ unzipper@0.12.5
└─ uuid@11.1.1

@typescript-eslint/typescript-estree@8.62.1
└─ minimatch@10.2.5
   └─ brace-expansion@5.0.8

ESLint/config/plugins (development only)
└─ minimatch@3.1.5
   └─ brace-expansion@1.1.15
```

## Runtime, regression, and security evidence

Focused verification covers 6 files and 52 tests after the real formula-cell case was added:

- **Application runtime boundary:** admin route rejects unauthorized callers before file access/parser invocation; rejects an oversized file before parsing; rejects an invalid signature; and returns/logs no raw dependency error.
- **Helper/runtime:** a real ExcelJS-generated contest workbook round-trips through `parseExcelContest`; a malformed ZIP-signature workbook is rejected; a real ExcelJS formula object is rejected rather than trusting its cached result.
- **Helper/runtime:** ExcelJS conditional-formatting serialization/deserialization creates a UUID-backed x14 identifier through `uuid@11.1.1`.
- **Helper/runtime:** ExcelJS’s streaming workbook writer generates a ZIP through retained Archiver/ZipStream parents and the result loads successfully.
- **Simulation:** bounded synthetic files are matched through the overridden Glob consumer, archived, extracted with Unzipper 0.12.5, and cleaned in `finally`.
- **Bounded subprocess security probe:** the production Minimatch 10/brace-expansion 5 path runs with a 64 MiB heap, 2-second timeout, and 64 KiB output cap. A 30-group consecutive non-expanding CPU probe and a bounded max-output expansion both complete successfully.
- **Helper/runtime with mocked transaction:** existing atomic import tests prove all-or-nothing transaction behavior and safe failure handling without a database.
- **Static source checks:** existing resource-limit tests inspect fixed parser/route limits; these are not represented as runtime proof.
- **Isolated PostgreSQL integration:** zero cases run. Database behavior did not change, so opt-in PGlite tests were not run.

The default suite passes 43 files: 470 passed and 8 skipped after the new formula case. No test timeout was increased, no assertion was weakened, and no audit result was suppressed.

## Verification results

| Command | Result |
| --- | --- |
| `npx.cmd prisma validate` | Exit 0; schema valid |
| `npx.cmd prisma generate` | Exit 0; Prisma Client 6.19.3 generated |
| `npm.cmd run typecheck` | Exit 0 |
| `npm.cmd run lint` | Exit 0 |
| Focused Vitest set | Exit 0; 6 files, 52 passed |
| `npm.cmd test` | Exit 0; 43 files, 470 passed, 8 skipped |
| `npm.cmd run build` | Exit 0 after ExcelJS externalization; 63 routes/pages generated |
| `npm.cmd audit` | Exit 1; 1 High vulnerable package entry, 2 GHSA records |
| `npm.cmd audit --omit=dev` | Exit 0; zero vulnerabilities |
| `git diff --check` | Exit 0 |

The build used explicit synthetic configuration with an unreachable loopback PostgreSQL endpoint. Two build-time collection attempts failed closed and emitted only `Database operation failed` with fixed action/error-class fields. No connection to a real database was possible or attempted.

## Removed and remaining advisories

Production audit objects for ExcelJS, Archiver, Archiver Utils, ZipStream, Readdir Glob, Glob, Minimatch, brace-expansion, Unzipper’s former Fstream/Rimraf path, and UUID are removed. `GHSA-w5hq-g745-h8pq` is removed completely. Production instances affected by both brace-expansion advisories are removed.

The full audit retains:

```text
eslint / eslint-config-next development paths
└─ minimatch@3.1.5
   └─ brace-expansion@1.1.15
      ├─ GHSA-3jxr-9vmj-r5cp
      └─ GHSA-mh99-v99m-4gvg
```

This is a precise non-production disposition, not a claim that the vulnerable code is intrinsically safe:

- required principal/input: a developer, CI operator, or compromised development workflow able to supply a crafted local lint glob/pattern;
- realistic impact: local/CI CPU or memory denial of service;
- production exploit path: none in this repository because the package is omitted by `npm audit --omit=dev`, is not imported by application code, and receives no learner/admin request pattern;
- controls: fixed repository lint invocation/config and no deployed lint endpoint;
- residual impact: a malicious local pattern can still affect a developer or CI process;
- minimum future remediation: upstream ESLint/config/plugin consumers must leave Minimatch 3, or brace-expansion must publish a compatible line that addresses both advisories. A global brace-expansion 5 override is not acceptable because it was proven API-incompatible;
- public-beta effect: this development-only finding does not block the dependency gate.

## Formula-validation UI correction continuation

This narrowly scoped continuation began on `security-phase-1d-c2-transitive-dependencies` at full HEAD `7e582904c392a743dc8a0e62c5d18f4d494efd19`. The tracked worktree and repository index were clean. The unrelated untracked `=`, `--json`, and existing review patches were inventoried by filename only and were not read, modified, deleted, staged, or included. The correction is recorded in commit `a743e3a18c1fab825f07d6ae81b8de87bdc461c5`.

The supplied historical Preview evidence established that a valid synthetic XLSX rendered its preview and a formula-bearing parse returned HTTP 200/application-json without checked server errors, but the page reached the App Router error UI. Local runtime reproduction against the actual application import-page source established the exact cause:

1. `parseExcelContest()` correctly returned `{ data: null, errors: [...], warnings: [] }` for a formula cell.
2. `POST /api/admin/contests-import/parse` correctly serialized that expected validation result with HTTP 200.
3. `handleFileChange()` in `src/app/admin/contests-builder/import/page.tsx` treated every non-empty `errors` result as `{ status: "preview", data: json.data, ... }`.
4. The production preview JSX immediately evaluated `state.data.info.title`; because `data` was `null`, React threw `Cannot read properties of null (reading 'info')`, reaching the App Router error boundary.

The correction introduces a dedicated `validation` state. The response decoder requires structurally valid arrays, permits preview only when `errors` is empty and `data` has the render-required shape, normalizes formula feedback to a fixed Vietnamese message, caps rendered issues at 20, and maps malformed/unexpected responses to a generic fail-closed error. Validation UI contains no draft-creation action and keeps the upload control available for correction/retry. A subsequent valid response transitions normally to preview. The draft action also catches unexpected failures and returns generic UI feedback.

Formula and shared-formula rejection remains fail-closed. Parser formula errors now include `code: "FORMULA_NOT_ALLOWED"` and a fixed message that does not interpolate the formula. Parser output is bounded to the first 20 formula locations plus one generic overflow record. The parser also rejects a ZIP container with no end-of-central-directory record before invoking ExcelJS. That stricter precheck resolved a repeatable normal-suite timeout on the existing 10-byte `PK`-header-only fixture without increasing a timeout or weakening a test.

Runtime evidence uses only generated synthetic workbooks:

- **Application parser/helper runtime:** valid XLSX succeeds; ordinary and shared-formula cells fail; a many-formula workbook returns at most 21 formula records; source ArrayBuffer bytes remain unchanged; formula text is absent.
- **Repository Route Handler runtime:** the actual exported `POST` with the real parser returns a valid preview contract for an authorized workbook and a bounded `{ data: null, errors, warnings: [] }` contract for formula validation. This is repository runtime evidence, not deployed Production evidence. Authorization, origin, and rate-limit collaborators are mocked; the contest-persistence action remains uncalled. Recursive response checks exclude stack/cause/raw-error/provider/path/connection fields and synthetic formula/unrelated-content sentinels.
- **Application-source UI/component runtime:** the real application-source file-selection transition posts a FormData file to the mocked parse endpoint; the actual application-source view renders bounded Vietnamese validation without throwing or containing the App Router error text; draft creation is absent and the persistence action is uncalled. A subsequent valid response recovers to the normal preview. Unexpected fetch failure remains generic and fail-closed.
- **Existing static checks:** existing parser resource-limit/formula source assertions still pass but remain classified as static checks, not runtime proof.
- **Database integration:** zero PGlite or real PostgreSQL cases ran; no database behavior changed.

Verification for the continuation:

| Command | Result |
| --- | --- |
| `npx.cmd prisma validate` | Exit 0 |
| `npx.cmd prisma generate` | Exit 0 |
| `npm.cmd run typecheck` | Exit 0 |
| `npm.cmd run lint` | Exit 0 |
| Focused parser/route/UI set | Exit 0; 6 files, 36 passed |
| First two pre-precheck `npm.cmd test` runs | Exit 1; the same existing 10-byte pseudo-XLSX test timed out at 5 seconds while 478 passed and 8 skipped |
| First post-precheck `npm.cmd test` | Exit 0; 46 files, 479 passed, 8 skipped |
| Second post-precheck `npm.cmd test` | Exit 0; 46 files, 479 passed, 8 skipped |
| Synthetic unreachable-database build | Exit 0; 63 routes/pages |
| `npm.cmd audit` | Exit 1; one High development-only brace-expansion package entry, two GHSAs |
| `npm.cmd audit --omit=dev` | Exit 0; zero vulnerabilities |
| `git diff --check` and `git diff --cached --check` | Exit 0 |

Continuation changed-file inventory:

- `src/app/admin/contests-builder/import/page.tsx`
- `src/app/admin/contests-builder/import/page.test.tsx`
- `src/app/api/admin/contests-import/parse/route.formula-runtime.test.ts`
- `src/lib/import/excel-contest-parser.ts`
- `src/lib/import/excel-contest-formula-runtime.test.ts`
- `src/lib/import/test-fixtures/synthetic-contest-workbook.ts`
- `docs/SECURITY_PHASE_1D_C2_REPORT.md`
- `handoff.md`
- `englishphile-phase1d-c2-formula-ui-correction-review.patch` (review artifact only; excluded from itself)

No schema, migration, seed, dependency, lockfile, test timeout, provider state, real infrastructure, or persisted contest changed.

## Preview operational reconciliation

The following observations are owner-attested operational evidence and are separate from the repository tests and local command evidence above.

### Initial dependency Preview

- Vercel and Vercel Preview Comments passed.
- A generated valid XLSX reached the actual application contest parser running on Preview and rendered the normal preview with title `Phase 1D-C2 Preview XLSX Probe`, one section, and one question.
- ExcelJS externalization worked on Preview, and the checked runtime window showed neither an optional S3-module resolution failure nor any runtime log entry.
- No contest draft was created.

### Historical formula failure before the correction

- A formula-bearing XLSX was posted to `/api/admin/contests-import/parse`.
- The API returned HTTP 200 with `application/json`, but the page reached the generic App Router error UI.
- The checked server-log window contained no corresponding runtime error.
- This was the pre-correction behavior that led to the local root-cause investigation. It is not the current disposition.

### Local correction evidence

The actual application parser exercised locally correctly returned `{ data: null, errors: [...], warnings: [] }`. The old client converted any non-empty `errors` result into preview state, after which preview JSX dereferenced `state.data.info` while `data` was `null`. Commit `a743e3a18c1fab825f07d6ae81b8de87bdc461c5` added a dedicated validation state, structural response decoding, bounded fixed Vietnamese formula guidance, fail-closed handling for malformed or unexpected responses, no draft action during validation, continued formula/shared-formula rejection, bounded formula-error output, and valid retry/recovery behavior. Its application-source transition-helper and view test is runtime component evidence, but not a fully mounted browser test.

### Correction Preview

- PR #16 head was `a743e3a18c1fab825f07d6ae81b8de87bdc461c5`; the supplied state was OPEN, Draft, MERGEABLE, and targeting `main`.
- Vercel and Vercel Preview Comments succeeded, with zero failing and zero pending checks.
- A formula-bearing XLSX rendered the in-page alert “File Excel chưa hợp lệ — không thể tạo contest draft.” and fixed Vietnamese guidance to convert formulas to static values.
- Raw formula content and the generic App Router error page were absent. The draft-creation action was absent while validation failed, while the upload control remained available.
- Uploading a valid XLSX afterward recovered to the normal preview, and the “Tạo contest draft” button returned.
- No contest draft was created. The checked Preview runtime-error window and sensitive-data log check were both clear.

### Operational credential-response boundary

Authentication/session material exposed during investigation was treated as compromised. The affected old Preview deployment was deleted, the Preview signing credential was rotated, Production used a separate rotated signing credential, and Production was redeployed after rotation with a passing health check. No protected value or operational identifier is recorded here. These containment actions are not application-code test evidence and do not establish C2 Production functional verification.

### Still-pending Production boundary

PR #16 remains OPEN and Draft. It has not merged, and Phase 1D-C2 has not received Production functional verification. The rotation-related Production health check is not a C2 spreadsheet, dependency-path, authorization, persistence, or release verification.

## Public-beta and H-11 disposition

All production dependency advisories are remediated, so Phase 1D-C2 no longer blocks public beta on the dependency-advisory condition. This report does not clear unrelated product, operational, privacy, or security gates.

H-11 remains **Partially remediated**. No at-rest encryption, retention, historical-row cleanup, contest-code hashing, account deletion, provider deletion, portable-export encryption, or Writing/provider-output retention work occurred.

## Changed-file inventory

- `package.json` — scoped dependency overrides
- `package-lock.json` — reviewed transitive resolution and integrity records
- `next.config.ts` — externalize Node-only ExcelJS from the server bundle
- `src/lib/import/excel-contest-parser.ts` — support ExcelJS row/formula value shapes
- `src/lib/security/phase1d-c2-dependencies.test.ts` — workbook, UUID, archive, and bounded brace probes
- `src/app/api/admin/contests-import/parse/route.test.ts` — production route authorization/limits/error-safety evidence
- `docs/SECURITY_PHASE_1D_C2_REPORT.md` — this report
- `docs/SECURITY_AUDIT.md` — Phase 1D-C2 addendum
- `README.md` — current dependency/security checkpoint
- `handoff.md` — current handoff checkpoint
- `englishphile-phase1d-c2-transitive-dependencies-review.patch` — generated review artifact, intentionally untracked and unstaged

No Prisma schema, migration, Next/PostCSS/Sharp version, ESLint Config Next version, unrelated direct dependency, or real infrastructure changed.

## Evidence limitations

- The repository implementation and local correction did not access a real provider, endpoint, browser, database, deployment, or runtime log. The Preview observations above are separately supplied owner-attested operational evidence; no browser automation is claimed.
- Ordinary-`STUDENT` authorization was not retested for C2. No persistence behavior is claimed because no contest draft was created.
- No managed PostgreSQL, PGlite, pooler, failover, concurrency, rollback, or C2 Production functional evidence was created.
- Archive generation/extraction beyond XLSX is synthetic compatibility evidence because Englishphile has no active standalone archive route.
- The UUID test exercises ExcelJS’s real conditional-formatting path, but Englishphile’s contest parser does not create security-sensitive UUIDs.
- Post-load worksheet/row/cell caps do not bound decompression before ExcelJS load; the administrator-only route’s 2 MiB compressed-file cap is the pre-load bound.
- npm 11’s six pre-existing optional WASM “extraneous” artifacts remain disclosed above.
- The supplied Preview checks do not establish every ExcelJS, ZIP, Sharp, platform, cache, managed PostgreSQL, or provider path.
- Clearing C2’s production dependency-advisory gate is not blanket public-beta or release clearance. H-11 remains **Partially remediated**.
