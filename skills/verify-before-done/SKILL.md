---
name: verify-before-done
description: "Use after project edits are complete and before the final response when concrete verification evidence is required. Compare the patch with the latest request, run risk-matched checks, fix relevant failures, and report remaining gaps honestly."
---

# Verify Before Done

Use this as an independent completion gate. It does not choose how implementation was planned and does not require any other workflow skill.

## Completion Gate

1. Rebuild the acceptance list from the user's latest request, repository rules, and declared untouched scope.
2. Inspect only the relevant changed paths. Classify each requirement as satisfied, partial, missing, or out of scope; fix mismatches before continuing.
3. Choose the smallest verification set that proves the risk: static checks, focused unit tests, integration tests, build, E2E, or a directly observable manual path.
4. For data-dependent behavior, use the safest representative environment available: read-only data, staging, a transaction with rollback, a sanitized snapshot, or realistic fixtures. Never mutate production merely to obtain evidence.
5. Diagnose relevant failures, fix them, and rerun the failed or affected checks. Stop only when green or when a real blocker/risk is explicit.
6. Report what changed, exact checks and outcomes, uncovered risks, and any environment limitation. Never imply a check ran when it did not.

## Rules

- Build and type checks are prerequisites when relevant, not substitutes for behavior proof.
- User-visible workflow changes normally need integration or E2E evidence.
- Separate patch-related failures from verified pre-existing baseline failures.
- Keep full noisy output outside the main response; retain a reproducible command and log path when available.
- If the user forbids verification or required access is unavailable, state the limitation and the strongest safe substitute.

## Load References Only When Needed

- Read [Verification Ladder](references/verification-ladder.md) when the appropriate verification depth is unclear.
- Read [Report Examples](references/examples.md) only when a concise evidence report needs a template.
