# Devpilot Agent Production Runbook

This runbook defines the production operating shape for the server-agent
task-pull process. It assumes the API config pack and command policy templates
are already reviewed:

- [`production-config-pack.md`](./production-config-pack.md)
- [`command-policy-templates.md`](./command-policy-templates.md)

## API enablement gates

Keep all gates disabled until the target environment has a command policy,
rollback owner, and tenant access check.

```bash
SERVER_EXECUTOR_QUEUE_WORKER_ENABLED=true
SERVER_EXECUTOR_AGENT_TARGET_ENABLED=true
SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED=true
SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED=true
SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED=true
SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED=true
SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN=<task-pull-secret>
SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN=<heartbeat-secret>
SERVER_EXECUTOR_AGENT_HEARTBEAT_TTL_SECONDS=120
```

Use separate task-pull and heartbeat tokens. The API can fall back to the
heartbeat token for task-pull authorization if the task-pull token is missing,
but production should not rely on that fallback.

## Agent environment file

Store this outside the repo, for example `/etc/devpilot/agent.env`, with owner
`root:devpilot-agent` and mode `0640`.

```bash
DEVPILOT_API_URL=https://devpilot-api.example.com/api
DEVPILOT_TEAM_ID=<team-id>
DEVPILOT_SERVER_ID=<server-id>
DEVPILOT_AGENT_ID=<agent-id>
DEVPILOT_AGENT_RUNNER_ID=prod-agent-01
DEVPILOT_AGENT_TASK_PULL_TOKEN=<task-pull-secret>
DEVPILOT_AGENT_HEARTBEAT_TOKEN=<heartbeat-secret>
DEVPILOT_AGENT_HEARTBEAT_STATUS=ready
DEVPILOT_AGENT_HEARTBEAT_HOSTNAME=prod-agent-01
DEVPILOT_AGENT_HEARTBEAT_VERSION=<release-version>
DEVPILOT_AGENT_HEARTBEAT_TTL_SECONDS=120
DEVPILOT_AGENT_TASK_PULL_INTERVAL_MS=5000
DEVPILOT_AGENT_TASK_PULL_ACK_RENEWAL_INTERVAL_MS=25000
DEVPILOT_AGENT_TASK_PULL_FORCE_KILL_GRACE_MS=5000
DEVPILOT_AGENT_CAPABILITIES=deploy,rollback,logs
```

## Service command

Run the agent from a service manager, not a shared interactive shell. The
execution cwd should be the narrow release/worktree base allowed for commands,
not the monorepo root.

```ini
[Unit]
Description=Devpilot server-agent task-pull
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=devpilot-agent
Group=devpilot-agent
EnvironmentFile=/etc/devpilot/agent.env
WorkingDirectory=/srv/devpilot-agent
ExecStart=/usr/bin/env corepack pnpm --filter @svton/cli exec svton agent task-pull run --forever --pid-file /run/devpilot-agent/task-pull.pid --cwd /srv/devpilot-agent/releases/current --heartbeat-token ${DEVPILOT_AGENT_HEARTBEAT_TOKEN} --heartbeat-status ${DEVPILOT_AGENT_HEARTBEAT_STATUS} --heartbeat-hostname ${DEVPILOT_AGENT_HEARTBEAT_HOSTNAME} --heartbeat-version ${DEVPILOT_AGENT_HEARTBEAT_VERSION} --heartbeat-ttl-seconds ${DEVPILOT_AGENT_HEARTBEAT_TTL_SECONDS}
Restart=always
RestartSec=5
RuntimeDirectory=devpilot-agent
RuntimeDirectoryMode=0750
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

The CLI refuses to start an unbounded loop unless `--forever`,
`--max-iterations`, or `--idle-limit` is set. Production service mode should use
`--forever`; rehearsal mode should use a finite bound.

## Runtime checks

- The pid file prevents duplicate live loops when it points at a live process.
- Heartbeat failure stops the loop with a `heartbeat_failed` summary.
- Poll failure stops the loop with a `poll_failed` summary.
- Step cwd resolution blocks command steps outside the configured `--cwd` base.
- The API marks missing, expired, or expiring heartbeats in supervisor
  readiness; with `SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED=true`, target
  selection requires an online runtime.

## Operations

1. Enable API gates in staging first and verify `/execution-governance` shows
   heartbeat, task-pull contract, and queue readiness.
2. Start the service and confirm exactly one pid file exists.
3. Trigger a read-only or dry-run job before live deploy.
4. Confirm the loop summary includes the expected runner id, pid-file status,
   heartbeat status, TTL, ack renewal interval, and force-kill grace.
5. Rotate task-pull and heartbeat tokens separately. Restart the service after
   updating `/etc/devpilot/agent.env`.
6. On incident response, disable `SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED` or
   stop the service before changing command policy templates.

## Blockers to record

- Missing service manager or non-root-owned env file.
- Shared task-pull and heartbeat token in production.
- Agent cwd points at the monorepo root or another broad writable path.
- Heartbeat is not required for production target selection.
- Command policy template is missing, disabled, or not scoped to the target.
