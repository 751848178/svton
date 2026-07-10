# Context Contracts

Pass artifacts instead of chat history. Each artifact should be short, traceable, and scoped to the receiving agent.

## Architecture Brief

```json
{
  "id": "ARCH-001",
  "goal": "Refactor deployment control plane",
  "module_boundaries": [
    {
      "module": "deployment",
      "owns": ["deployment config", "deployment status"],
      "does_not_own": ["log collection", "monitoring alerts"]
    }
  ],
  "dependency_rules": ["controller -> service -> repository"],
  "migration_order": ["types", "services", "ui adapters"],
  "risks": ["shared DTO changes affect API and Web"]
}
```

## Module Plan

```json
{
  "module": "deployment",
  "context_pack": ".agent-board/modules/deployment/context-pack.json",
  "contracts": ["public API response shape remains unchanged"],
  "atomic_todos": ["DEP-001", "DEP-002"]
}
```

## Atomic Todo

```json
{
  "id": "DEP-001",
  "type": "implementation",
  "status": "ready",
  "module": "deployment",
  "title": "Extract deployment config validator",
  "allowed_files": [
    "src/deployment/config.service.ts",
    "src/deployment/config-validator.ts"
  ],
  "read_only_files": [
    "src/deployment/config.types.ts",
    "src/deployment/config.service.spec.ts"
  ],
  "forbidden_scope": [
    "do not edit monitoring",
    "do not change public API response shape"
  ],
  "acceptance": [
    "existing deployment config tests pass",
    "no behavior change"
  ],
  "verification": {
    "command": "pnpm test deployment",
    "status": "pending",
    "log": null
  }
}
```

## Needs Context

Workers return this instead of broadening their own scope.

```json
{
  "status": "needs_context",
  "todo_id": "DEP-001",
  "question": "Is DeploymentConfigDto part of a public API response?",
  "requested_evidence": [
    "DeploymentConfigDto usages",
    "public response contract"
  ]
}
```

## Worker Result

```json
{
  "todo_id": "DEP-001",
  "status": "done",
  "changed_files": [
    "src/deployment/config.service.ts",
    "src/deployment/config-validator.ts"
  ],
  "summary": "Extracted config validation into a focused validator without behavior changes.",
  "verification": {
    "status": "passed",
    "log": "/tmp/codex-tool-runs/svton/DEP-001-test.log"
  },
  "risks": [],
  "needs_followup": []
}
```

## Verifier Summary

```json
{
  "todo_id": "DEP-001",
  "command": "corepack pnpm test deployment",
  "status": "failed",
  "exit_code": 1,
  "summary": "One assertion failed in deployment config defaults.",
  "relevant_errors": [
    "config.service.spec.ts:42 expected default strategy to equal rolling"
  ],
  "full_log": "/tmp/codex-tool-runs/svton/DEP-001-test.log"
}
```

## Reviewer Finding

```json
{
  "todo_id": "DEP-001",
  "status": "needs_changes",
  "findings": [
    {
      "severity": "P1",
      "file": "src/deployment/config.service.ts",
      "line": 42,
      "summary": "Default strategy changes for empty config."
    }
  ],
  "open_questions": []
}
```
