/**
 * 密钥脱敏纯函数：用于计划快照、日志、output、event、API、页面。
 *
 * 2026-08-22 DEP-1：通用脱敏实现上移至 src/common/secret-redaction.utils.ts
 * （deployment / server-executor 需要同一实现做命令计划存储侧统一脱敏，
 * 放在 release-orchestration 会造成模块循环依赖）。本文件保留原导入路径，
 * re-export 单一实现；stripSecretEnvFromSteps 是 release 侧的历史别名。
 */
import type { ServerCommandStep } from "../../server-executor/server-executor.types";

export {
  SECRET_REDACTED_MARKER,
  isLikelySecretKey,
  redactSecretsInText,
  redactSecretsInObject,
} from "../../common/secret-redaction.utils";

// 对命令步骤的 secretEnv 字段做剥离（与 deployment 模块一致语义）
export function stripSecretEnvFromSteps(
  steps: ServerCommandStep[],
): ServerCommandStep[] {
  return steps.map((step) => {
    if (!step || !("secretEnv" in step) || !(step as { secretEnv?: unknown }).secretEnv) {
      return step;
    }
    const { secretEnv: _omit, ...rest } = step;
    return rest as ServerCommandStep;
  });
}
