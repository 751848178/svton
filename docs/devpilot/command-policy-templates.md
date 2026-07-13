# Devpilot Command Policy Templates

Use these templates before enabling `SERVER_EXECUTOR_LIVE_ENABLED=true`.
Command policy template patterns are micromatch globs by default. Prefix a
pattern with `regex:` when the pattern is intended to be a regular expression.

## Demo-safe disposable target

Use this only with the local disposable target from
[`demo-runbook.md`](./demo-runbook.md). Keep the live executor bound to a
throwaway worktree and rotate the token after the rehearsal.

```json
{
  "name": "demo-safe-disposable-nginx",
  "description": "Only allows disposable /tmp worktree deploy and rollback commands for the local nginx target.",
  "enabled": true,
  "priority": 100,
  "adapterKeys": ["deployment-script-plan"],
  "operationKeys": ["deployment.run", "deployment.rollback"],
  "allowedPatterns": [
    "regex:^git fetch --all --prune$",
    "regex:^git checkout [a-zA-Z0-9._/@-]+$",
    "regex:^git pull --ff-only$",
    "regex:^(pnpm|npm|yarn|bun) (install|ci|run build|build)( [a-zA-Z0-9_./:@=-]+)*$",
    "regex:^docker compose (pull|up -d( --build)?|restart)( [a-zA-Z0-9_./:@=+-]+)*$",
    "regex:^curl -fsS ('https?://[^']+'|https?://\\S+)$"
  ],
  "blockedPatterns": [
    "regex:.*\\brm\\b.*",
    "regex:.*\\bsudo\\b.*",
    "regex:.*\\bchmod\\s+777\\b.*",
    "regex:.*\\b(curl|wget)\\b.*\\|\\s*\\b(sh|bash)\\b.*",
    "regex:.*\\b(password|secret|token)=\\S+.*",
    "regex:.*(;|\\|\\||&&|`|\\$\\(|>|<).*"
  ]
}
```

## Production-safe approved deploy

Use this only after the target project, environment, SSH key, approval text, and
rollback owner are known. Bind the template to the narrowest project/environment
scope available in the UI/API.

```json
{
  "name": "production-safe-approved-deploy",
  "description": "Scoped deployment commands only; pair with human approval, SSH key auth, and environment-specific project/env scope.",
  "enabled": true,
  "priority": 200,
  "adapterKeys": ["deployment-script-plan"],
  "operationKeys": ["deployment.run", "deployment.rollback", "deployment.smoke_check"],
  "allowedPatterns": [
    "regex:^git fetch --all --prune$",
    "regex:^git checkout [a-fA-F0-9]{7,64}$",
    "regex:^git checkout (main|master|release/[a-zA-Z0-9._-]+)$",
    "regex:^git pull --ff-only$",
    "regex:^(pnpm|npm|yarn|bun) (install|ci|run build|build)( [a-zA-Z0-9_./:@=-]+)*$",
    "regex:^docker compose (pull|up -d --build|restart [a-zA-Z0-9_.-]+)$",
    "regex:^curl -fsS ('https://[^']+'|https://\\S+)$"
  ],
  "blockedPatterns": [
    "regex:.*\\brm\\s+-rf\\b.*",
    "regex:.*\\bsudo\\b.*",
    "regex:.*\\bchmod\\s+777\\b.*",
    "regex:.*\\bchown\\b.*",
    "regex:.*\\bscp\\b.*",
    "regex:.*\\bssh\\b.*",
    "regex:.*\\b(curl|wget)\\b.*\\|\\s*\\b(sh|bash)\\b.*",
    "regex:.*\\b(password|secret|token)=\\S+.*",
    "regex:.*(;|\\|\\||&&|`|\\$\\(|>|<).*"
  ]
}
```

## Validation checklist

- Keep built-in dangerous command rules enabled; templates only narrow or add
  environment-specific allows.
- Prefer one shell command per execution step. Avoid `&&`, `||`, pipes,
  redirection, command substitution, and inline secrets.
- Keep `SERVER_EXECUTOR_LIVE_ENABLED=false` until the target has a template,
  required confirmation text, rollback path, and owner.
- Run the server command policy test after template changes:

```bash
corepack pnpm --filter @svton/devpilot-api exec jest --runInBand src/server-executor/server-command-policy.service.spec.ts
```
