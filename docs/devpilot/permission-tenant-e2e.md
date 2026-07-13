# Devpilot Permission And Tenant E2E

Run this check before production MVP handoff against a disposable staging API.
It verifies both sides of the critical tenant boundary: a user can operate
inside their own team, and a different user cannot reuse that team id.

## Command

```bash
DEVPILOT_API_URL=https://devpilot-api.example.com/api \
node scripts/devpilot-permission-tenant-e2e.mjs
```

The script creates two users and two teams, then checks:

- user A can read team A;
- user B cannot read team A;
- user A can call a team-scoped resource-control endpoint with team A;
- user B cannot call the same endpoint with team A in `x-team-id`;
- user B can call the endpoint with team B.

If the API is unavailable, the script prints `blocked_external` with the API
URL and reason. Treat that as an environment blocker, not a pass.

## Evidence

Store the full command log under `/tmp/codex-tool-runs/svton/` and keep the JSON
summary with the created team ids. Do not run this against production unless the
created users/teams are approved test identities with a cleanup plan.
