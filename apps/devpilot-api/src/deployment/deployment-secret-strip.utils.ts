/**
 * Persistence-safety helper for the credential-injection flow.
 *
 * CRITICAL (F1/F2): a `ServerCommandStep` built by `buildEnvWriteStep` carries
 * the REAL DB/Redis passwords in its `secretEnv` field, while its `command`
 * field carries a redacted mirror. The redaction is cosmetic if the step is
 * then serialized wholesale: `toJsonValue(steps)` / `JSON.parse(JSON.stringify(steps))`
 * keeps `secretEnv` verbatim. This helper MUST be applied at every persistence
 * site (`DeploymentRun.commandPlan`, `serverExecutionJob.inputSnapshot`) so the
 * plaintext secrets never reach a JSON column or an API response.
 *
 * Call sites (keep this list in sync):
 *  - `deployment.service.ts` — blocked-by-approval + rollback blocked commandPlan
 *  - `script-plan.adapter.ts` — live/dry-run commandPlan
 *  - `server-executor-result.utils.ts` — cancelled + queued commandPlan
 *  - `server-executor-blocked-result.utils.ts` — policy + concurrency commandPlan
 *  - `server-executor-input-snapshot.utils.ts` — job inputSnapshot (exposed via API)
 */

import { ServerCommandStep } from '../server-executor';

/**
 * Return a copy of `steps` with the `secretEnv` field removed from every
 * step that carries one. Steps without `secretEnv` are returned as-is (same
 * reference). The function is pure and never mutates its input.
 */
export function stripSecretEnv(steps: ServerCommandStep[]): ServerCommandStep[] {
  return steps.map((step) => {
    if (step.secretEnv === undefined) return step;
    // Destructure to drop the secret field; the remaining fields are plain
    // command descriptors and are copied by the object spread.
    const { secretEnv: _removed, ...rest } = step;
    return rest as ServerCommandStep;
  });
}
