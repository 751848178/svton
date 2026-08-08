# Devpilot V13 OpenCode Independent Acceptance Report

## Status

Independent verification is in progress. No historical `done`, `351/351`, worker count, reviewer statement, screenshot hash, or `ACCEPTED` text is treated as a current-run conclusion.

## Frozen Audit Identity

- Range: `bf3e6fabb0f637ebe2ce7eb381f5cbd5918d8ef3..5f4685169a6e1995c32612303b3b20f859e87bb6`
- Branch at start: `codex/devpilot-project-delivery-v13`
- Audit HEAD: `5f4685169a6e1995c32612303b3b20f859e87bb6`
- Changed range: 278 files, 30,160 insertions, 2,015 deletions
- Current local master merge-base: `b6c3488743be13eacf4320f685da927488490113`
- Divergence: master-only 3, V13-only 87
- Frozen Demo SHA-256: `523080f43d935dba737fdfc0013f5133dc140c6d19936077692dfa556b549b0a`
- Frozen canonical spec SHA-256: `a491e9f5e9f583bf92fc56ef804a0884f5ab65bd93156a318b809f2b5b605393`

## Evidence Boundary

Canonical spec defines semantics; Demo defines page structure, hierarchy, interaction, state, and visual expectation. Historical evidence is admissible only after path existence, hash, commit provenance, screenshot state, runtime provenance, and clean reproducibility are checked. Current-run browser screenshots must include URL, viewport, fixture and runtime IDs, HEAD, timestamp, hash, DOM/text, console/network, and Demo mapping.

## Review Tracks

| Track | Status | Result |
| --- | --- | --- |
| Code/architecture | completed | REJECTED: 278/278 paths, 5 P1 + 2 P2 |
| Product UI/browser | completed | REJECTED: auth deadlock; signed-in matrix not reproducible |
| Runtime/E2E/security | completed | REJECTED: 8 P1 + 2 P2 + 1 P3; current test/migration evidence recorded |

## Independent Findings

F464-F565 are registered in the acceptance TODO. The response/schema, marker completeness, negative-history trusted graph, header/event sanitization and browser artifact capability findings now have atomic source fixes with focused adversarial proof. F555-F560 close preview-hash continuity, trusted route derivation, exact Production/Staging chains, runtime result inventories, EnvironmentVersion foreign-key edges and per-model distinctness; F562 repairs the F559 per-field test mutators so that proof is not false-positive. F548-F551 now use a fresh pinned run plus parent-preopened descriptor outputs and nonce-bound receipts, closing the recorded same-UID swap-restore boundary for artifact evidence. F534/F535 were not accepted merely because candidate commits existed: their defects were corrected independently by F563/F564, and F560's duplicated candidate was replaced by F565. Current blockers remain the real route provider/readback and migration/fresh-intake evidence, isolated current-image provenance/namespace/scoped-cleanup gates F476/F494/F518, the broader negative-E2E false-attribution and structure backlog, and retained F461/F462 production risks. Detailed source/runtime/browser and post-commit evidence lives in the worker detail reports; no C5 runtime/browser acceptance is claimed yet.

Parallel-wave checkpoint: F543 adversarial review completed and registered F561 for adjacent-safe-field over-redaction. F544 landed atomically as `a74cb34e`; syntax, per-family security fixtures, F530/F539/F543/F547/F531 self-tests, Prettier, diff, path and line-count gates passed. No F545-F560, external worktree, push, integration, deployment, or Goal terminal-state action was performed.

First-batch external integration checkpoint: F470 source `69909f0f` was independently reviewed and cherry-picked as `a3164709`; exact team-scoped pending CAS, structured loser 409, one-transaction winner/audit, audit rollback and consume semantics passed focused 15/15, API type-check and a fresh disposable-MySQL barrier 4/4. F555 source `a0325487` was independently reviewed and cherry-picked as `e6c1a80f`; standard/recovery preview-confirm hash continuity, request-owned serialization, trusted Vprod1 recovery binding, producer-shaped fixtures and contract/identity regressions passed. The two integrated patches have identical source/cherry-pick patch IDs, an exact 17-path union, clean diff/topology gates and no maintained production source over 200 lines; the legacy history producer shrank to 1245 lines without increasing its 76-hunk Prettier baseline. F559-F560, F537 isolated runtime execution, browser/runtime reruns and the overall Goal remain open.

Second-batch priority intake checkpoint: clean `opencode/devpilot-v13-f555` produced a linear F556-F559 chain. F556 source `b9f3dbe3` was independently reviewed and cherry-picked as `2911b9e0`: route-derived fields are rebuilt from trusted Production roots, and coherent alternate-route plus individual route-field substitutions reject. F557 source `d0f9744c` was independently reviewed and cherry-picked as `44f56d93`: exact anchored Production/Staging row chains reject malformed or extra prefixes, duplicate Vprod1, bad linkage, kind, manifest, ID, missing and reordered rows without trusting producer booleans. Both source/cherry pairs have matching patch IDs and passed their immutable-snapshot and current-tree Node contract/identity/graph/formatter/diff gates. F558/F559 and clean ZCode F534/F545/F546/F561 results were discovered by the one-time intake but deliberately deferred for independent review under the next atomic-stage budget; no completion claim is made for them.

Second-batch follow-up checkpoint: F558 source `6309518b` was independently cherry-picked as `152782e9`, enforcing the exact 16-step result-key inventory inside full history parsing before acceptance and identity validation; unknown/missing keys and producer-shape drift reject. F559 source `b9d03f56` passed immutable review and focused foreign-key adversarial tests but its exact cherry-pick conflicted in the legacy history producer; the attempt was aborted and no hand merge occurred, so a new clean rebased external commit is required. ZCode F561 source `c75b9a7b` landed as `8558ed58`, preserving adjacent safe header fields. ZCode F545/F546 landed consecutively as `896f60a9` and `5408a03e`, adding separated credential-key forms then closing ordinary-word over-redaction. Every accepted source/cherry pair has a matching patch ID and passed immutable-snapshot plus current-tree Node/Prettier/diff gates. F534 remains unreviewed; no runtime/browser evidence claim has changed.

F534 rejection checkpoint: source `3beb853a` passed its supplied browser-artifact/CDP self-tests, but the maintained validator is 237 lines and `hasValidPngStructure` accepts a 3348-byte PNG containing a valid IHDR plus 255 legal `tEXt` chunks and no IEND. The exact commit was not cherry-picked. F534 requires a new immutable commit that both splits the production validator below the 200-line ceiling and requires complete PNG termination; no browser/runtime evidence claim changed.

F537 implementation checkpoint: a zero-input repo launcher now creates one canonical fresh run root, invokes F456 once (retaining F456's single nested F455 call), validates exact regular single-link F455/F456 path identities, SHA-256, captured/file times and linkage, writes an `O_EXCL` mode-0400 receipt, and passes retained F456/receipt descriptors to F474. F474 no longer accepts caller-selected path/SHA/window inputs and fails before Prisma binding without the launcher marker and FDs. Pure-Node tests reject stale evidence, final/ancestor symlinks, mutation, legacy self-hash/broad-window inputs and delayed consumption; complete runtime execution is honestly `needs_context` until isolated stack ownership, current-image provenance, cleanup arming and real provider/gate prerequisites are available. No F476 image provenance, production DNS/TLS, provider credential or production mutation is claimed.

C5 current-stack safety gate: the requested browser/evidence rerun was intentionally not launched. Current source fixes the parity compose project, `parity-*` container names, loopback ports and `devpilot_parity` database; the same named containers were already active. `parity-web` and `parity-api` have no OCI revision/source labels, while the negative driver scans all `awaiting_approval` runs in the shared production environment for cleanup. This fails the required F494 namespace, F476 provenance and F518 scoped-cleanup gates. No container, database, browser session, authentication state or public DNS was touched; F547+F544, F531 and F532 stay source-verified only, with C5 marked `needs_context`.

Third-batch integration checkpoint: F559-v2 source `5d6dbb16`, F534-v2 source `3027960f`, F525 source `a0e08ed`, F554 source `94a7670` and F538 source `48804154` were integrated as `8eb4d2be`, `177a931d`, `dfc23040`, `4d4797bd` and `366e80df`. Acceptance remained evidence-driven rather than source-label-driven: F559 production binding was sound but its scalar-returning adversarial mutators were corrected by F562 `38b17c67`; F534-v2 still emitted no-IDAT PNGs and used unavailable `node:zlib.crc32`, corrected by F563 `6536a2d8`. F535 source `be2e7af` and F560 source `ca6cc541` were rejected rather than cherry-picked; equivalent requirements were implemented without their defects as F564 `80ad0ee2` and F565 `0c7e8f34`. F525/F554/F538 passed immutable-source and integrated focused tests. These distinctions are retained so rejected source commits are never represented as accepted evidence.

F551 descriptor-capability checkpoint: commit `b6db8706` removes the artifact output path from the browser child contract. The parent creates a fresh pinned run, preopens the exact artifact plus `cdp-evidence.json` inventory with exclusive no-follow mode-0600 handles, passes only a name-to-FD plan and fresh 64-hex run nonce, reads back from the original handles, and rechecks device/inode/link/mode identity before cleanup. Swap-restore, inherited child descriptor, hardlink, symlink, FIFO, stale nonce, partial creation and injected child-failure cleanup tests pass on host Node 22 and container Node 18/20. Chrome profile storage is deliberately separate and outside the artifact-integrity claim. Browser/runtime acceptance remains pending the F494/F476/F518/F465 isolation gates; no C5 runtime claim is made by this checkpoint.

C5 isolation/F465 checkpoint: `e7a79492`/`36c13c95` parameterize a unique compose project, database, network, volumes, fixture root, images and six host ports, stamp current HEAD/tree/runtime provenance, arm manifest-owned cleanup, and refuse unrelated active ReleaseRuns. `8da7820a`, `c5f5a7af`, `f2a57167` and `2a46f2f0` then correct fresh-intake and exact current API response consumers exposed by successive clean isolated runs. `a8db392f` adds an explicit parity-only HTTP route-control process: token-authenticated apply, independent exact receipt readback, and a live route data path; the normal default remains `disabled/unconfigured`, and no localhost/public-DNS equivalence is claimed. Focused provider/receipt/compose tests, live apply/readback/proxy self-test, API/Web type-check, full API tests and full Web tests pass. The last clean-HEAD C5 rerun is not accepted: the host reached ENOSPC during Docker image commit, Docker Desktop reported containerd blob I/O failure and remained unresponsive after 1.8 GiB of run-owned/regenerable data was freed. Restarting Docker Desktop would interrupt the existing shared parity stack and was not authorized, so C5 runtime/browser/cleanup-success evidence remains `needs_context`; no browser acceptance or final Goal verdict is claimed.

## Historical Claim Revalidation

| Claim | Current classification | Current-run proof |
| --- | --- | --- |
| F434-F460 all done | failed as acceptance claim | P1 production/evidence defects remain |
| 351/351 acceptance items | failed integrity | 351 rows, 350 unique IDs; AC-PROD-025 duplicated |
| 101 workers completed | historical metadata only | worker count does not prove outcomes |
| Positive/history/negative E2E passed | stale/failed current provenance | positive is source-hardened; history mapping/identity/CDP schema/readback are hardened but F510-F512/F525 remain; negative is reopened by F513-F521; no clean current-image reset rerun |
| Demo parity accepted | not reproducible | protected implementation UI blocked; no downstream parity claim |
| Secret scan clean | verified with limitation | current focused security 40/40; historical artifact scan not regenerated |
| axe critical/serious zero | stale/not reproducible | no current signed-in axe run accepted |
| Final site browser reachable | failed as final-domain proof | loopback proxy target 200 is not public final URL |

## Known Boundary Decisions

- F461-F463 are assessed but not implemented in this goal.
- Advanced canary/blue-green/automatic ramp capability is not equivalent to fail-closed behavior and remains a separate canonical deferral.
- Local loopback reachability is not public DNS/TLS production readiness.
- The protected main checkout remains read-only, including user-owned `check2.mjs`.
- No push, PR, master integration, history rewrite, worktree deletion, or production change is authorized.

## Verdicts

- Demo parity: **NOT YET DECIDED — CURRENT AUDIT BLOCKED**
- Functional/runtime: **REJECTED**
- Security: **REJECTED**
- UI/UX/accessibility: **REJECTED / NOT REPRODUCIBLE**
- Evidence confidence: **LOW TO MEDIUM**
- Production readiness: **REJECTED**
- Master integration readiness: **REJECTED**
- Overall audit checkpoint: **REJECTED**

Only `ACCEPTED`, `ACCEPTED WITH LIMITATIONS`, or `REJECTED` may replace the overall placeholder after every completion gate is supported by current-run evidence.
