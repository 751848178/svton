# Devpilot Rehearsal Trace Governance

Devpilot production readiness must not depend on deleting failed or blocked
history. Rehearsal traces are audit evidence. Current readiness views should
scope them out when they are finished terminal records.

## Classification

| Class | Examples | Governance |
| --- | --- | --- |
| Current pressure | `queued`, `running`, stale `running`, and unfinished terminal jobs with `finishedAt = null` | Counts toward supervisor pressure and readiness blockers. Investigate before production handoff. |
| Audit history | `blocked`, `failed`, or `cancelled` jobs with `finishedAt` set | Keep searchable in job history and evidence summaries. Do not count as current task-pull readiness pressure. |
| Rehearsal artifact | Screenshots, final summary JSON, run ids, job ids, approval ids, CLI summaries | Store under the evidence directory and link from the run summary. |
| Throwaway data | Local demo database, demo Redis, disposable nginx target | May be reset only when it is clearly not shared production data. Keep old evidence directories. |

The supervisor job health query follows this split: blocked/failed/cancelled
counts and agent blocked-reason lists filter to unfinished terminal jobs, while
job history remains available through the execution-governance lists.

## Evidence archive

For each live rehearsal or production validation, capture:

- evidence directory path;
- API/Web startup log paths;
- migration log path;
- team id, project id, server id, deployment run id, rollback run id;
- server execution job ids and lease ids;
- policy-blocked or checkout-failed job ids that explain historical blockers;
- screenshots for `/execution-governance`, `/logs`, and `/monitoring`;
- final summary JSON.

The S005 live rehearsal evidence remains:

```text
/tmp/codex-tool-runs/svton/live-deploy-rollback-20260713-001800/final-live-summary.json
```

Keep this as source-of-truth history instead of editing database rows.

## Demo and readiness views

Use scoped views when presenting the current run:

```text
/execution-governance?serverId=$SERVER_ID&jobStatus=completed
/execution-governance?operationKey=deployment.run&jobStatus=completed
/execution-governance?operationKey=deployment.rollback&jobStatus=completed
```

If older failed or blocked rows appear in an unscoped list, label them as audit
history and point to the evidence archive. They should not be hidden by deleting
rows.

## Cleanup rules

- Never delete production execution jobs to make readiness look green.
- Never rewrite `result`, `error`, or `finishedAt` on historical jobs except via
  a documented migration approved for production data repair.
- For local demos, reset only the throwaway `devpilot_demo_*` database and demo
  Redis. Keep the old evidence directory.
- For shared staging, prefer scoped filters and archive notes over data
  deletion.
- If current pressure is caused by unfinished terminal jobs, fix the product
  path or record an explicit blocker; do not manually mark it away.

## Handoff checklist

- Current pressure count has no unexplained unfinished terminal jobs.
- Historical blockers are listed with job ids and evidence paths.
- Demo screenshots use scoped current-run URLs.
- Rehearsal data reset, if any, touched only throwaway local services.
- The production operator knows where audit history lives and why it remains
  searchable.
