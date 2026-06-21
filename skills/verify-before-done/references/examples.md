# Report Examples

Keep the final report short, but include the evidence needed to trust the result.

## Successful completion

```text
Implemented the requested login redirect fix. The changed flow now preserves the original target URL after auth and still falls back to `/dashboard` when no target is present.

Verification:
- `pnpm --filter web test auth-redirect.test.ts` passed
- `pnpm --filter web e2e auth-redirect.spec.ts` passed against staging user data
```

## Partial mismatch found and fixed

```text
The first pass handled the save action but missed the empty-state reload path from your request. I fixed that path as well.

Verification:
- `pnpm --filter app type-check` passed
- `pnpm --filter app test session-store.test.ts` passed
- `pnpm --filter app e2e session-reload.spec.ts` passed with a real saved session record in the test database
```

## Verification blocked

```text
The code changes are in place, but I could not complete real-data verification because the staging database credentials are not available in this environment.

Verified instead:
- `pnpm --filter api type-check` passed
- `pnpm --filter api test billing-calculation.test.ts` passed with synthetic fixtures

Remaining risk:
- The billing query still needs to be run against staging or a masked production snapshot before this is considered fully verified.
```

## Final response checklist

- Say whether the implementation matches the user's request.
- Name any mismatch, incomplete item, or scope tradeoff.
- List exact validation commands and outcomes.
- Say whether real data was used when data mattered.
- Name residual risk instead of hiding it.
