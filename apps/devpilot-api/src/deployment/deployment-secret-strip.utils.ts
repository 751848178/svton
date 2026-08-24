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
import { redactSecretsInObject } from '../common/secret-redaction.utils';

/**
 * Return a copy of `steps` with the `secretEnv` and `secretEnvExport` fields
 * removed from every step that carries either. Steps without either field are
 * returned as-is (same reference). The function is pure and never mutates its
 * input.
 *
 * `secretEnvExport` (F383 release-stage credential injection) holds the real
 * values backing `$DEVPILOT_*` placeholder references in the command; it is the
 * same exposure class as `secretEnv` and MUST be stripped at every persistence
 * site alongside it.
 */
export function stripSecretEnv(steps: ServerCommandStep[]): ServerCommandStep[] {
  return steps.map((step) => {
    if (step.secretEnv === undefined && step.secretEnvExport === undefined) {
      return step;
    }
    // Destructure to drop both secret fields; the remaining fields are plain
    // command descriptors and are copied by the object spread.
    const { secretEnv: _removed, secretEnvExport: _removedExport, ...rest } = step;
    return rest as ServerCommandStep;
  });
}

/**
 * 命令计划持久化统一脱敏入口（DEP-1，2026-08-22）。
 *
 * 在 stripSecretEnv（剥离 secretEnv/secretEnvExport 字段）之上，再对整个步骤
 * 数组做深度文本脱敏（redactSecretsInObject）：即使某个构建器把真实密钥写进了
 * `command` 字符串（历史泄露形态：write_env heredoc 里的 `DATABASE_URL=mysql://
 * user:pwd@…`、`JWT_SECRET=…`、`BOOTSTRAP_ADMIN_PASSWORD=…`），落库前也会被替换为
 * `[REDACTED]`。脱敏只发生在写入/存储侧；执行边界仍通过 secretEnv 重解析机制
 * 取回真实值（键名在脱敏后保留，`reapplyDeploymentEnvWriteSecrets` 依赖这一点）。
 *
 * 所有 `DeploymentRun.commandPlan` / `ServerExecutionJob.inputSnapshot` /
 * `ServerExecutionResult.commandPlan·commandSteps` 的写入点必须经由本函数，
 * 禁止各自调用 stripSecretEnv 后直接持久化。
 */
export function redactCommandPlanForPersistence(
  steps: ServerCommandStep[],
): ServerCommandStep[] {
  return redactSecretsInObject(stripSecretEnv(steps));
}
