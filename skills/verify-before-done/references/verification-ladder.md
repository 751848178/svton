# Verification Ladder

Use the highest-signal validation that is safe and practical for the change.

## Choose by change type

### Static or type-only changes

- Run type-check and lint when the repo has them.
- Run targeted tests if behavior could still change through typing, imports, exports, or config.

### Pure logic changes

- Run the narrowest unit tests covering the changed branch.
- Add or update tests when the changed behavior has no direct coverage.
- Include edge cases for empty input, invalid input, concurrency, and error paths when relevant.

### API, service, or data-flow changes

- Run integration tests that exercise the public entry point, not only private helpers.
- Verify request shape, response shape, error behavior, persistence, retries, and fallback behavior.
- Check callers if the contract changed.

### UI or workflow changes

- Run component tests when available.
- Run e2e or browser automation for user-visible flows, navigation, forms, async states, errors, and persistence.
- Capture enough evidence to know the rendered and interactive path works, not only that the code compiles.

### Data-dependent changes

- Use real data whenever the behavior depends on database content, existing records, migrations, analytics, permissions, cache state, or third-party data.
- Prefer safe real-data sources: staging, read-only queries, transaction rollback, masked snapshots, seed imported from real production shapes, or user-provided fixtures from real records.
- Do not treat synthetic data as equivalent to real data. Synthetic data can supplement edge cases, but the final report must say it is not real-data validation.
- Do not mutate production data for verification. Use read-only paths, isolated staging, temporary test tenants, or rollback.

## If verification is blocked

State the blocker plainly:

- Missing credentials, service, browser, database, seed data, or network.
- Command unavailable or failing before reaching the changed code.
- Real data unavailable or unsafe to use.

Then report what was verified instead and what risk remains.
