/**
 * 部署命令计划 - 环境变量 KEY 解析（纯函数）
 *
 * 单一职责：从 DeploymentRun.commandPlan 里提取「本次部署会写入 .env 的变量 KEY」。
 *
 * 背景（见 research/r2-issue234 §1.3）：
 * - 注入的真值从不落库（持久化的是 `KEY=***REDACTED***`，真值只在 secretEnv 运行期生效）。
 * - commandPlan 里 write_env 步骤的 command 形如：
 *     cat > .env <<'DEVPLOT_ENV_EOF'\nDATABASE_URL=***REDACTED***\nREDIS_HOST=***REDACTED***\nDEVPLOT_ENV_EOF
 * - 因此只能安全展示 KEY 名（值已脱敏），让用户知道「这次部署注入了哪些变量」。
 *
 * 复用 readDeploymentCommandSteps（同目录 deployment-config.ts），避免重复解析。
 */

import { readDeploymentCommandSteps } from './deployment-config';

/** write_env 步骤的 key 可能的取值（后端 buildEnvWriteStep 用 'write_env'，容错 'write-env'）。 */
const WRITE_ENV_STEP_KEYS = new Set(['write_env', 'write-env']);

/** 匹配 .env 行里的变量名（KEY=...），KEY 必须大写字母/下划线开头、含字母数字下划线。 */
const ENV_KEY_LINE = /^[A-Z_][A-Z0-9_]*=/;

/**
 * 从 commandPlan 解析出本次部署写入的 .env 变量 KEY 列表。
 *
 * @returns 去重、排序后的 KEY 名数组；无 write_env 步骤或 commandPlan 无效时返回 []。
 */
export function extractInjectedEnvKeys(commandPlan: unknown): string[] {
  const steps = readDeploymentCommandSteps(commandPlan);
  const keys = new Set<string>();
  for (const step of steps) {
    if (!WRITE_ENV_STEP_KEYS.has(step.key) || !step.command) continue;
    for (const line of step.command.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // 跳过 heredoc 边界（如 DEVPLOT_ENV_EOF）和 shell 命令行（cat > .env ...）。
      if (trimmed.startsWith('cat ') || trimmed.startsWith('echo ') || trimmed.includes('<<')) {
        continue;
      }
      const match = ENV_KEY_LINE.exec(trimmed);
      if (!match) continue;
      const keyName = trimmed.slice(0, trimmed.indexOf('='));
      if (keyName) keys.add(keyName);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, 'en'));
}

/** 该 commandPlan 是否存在 write_env 步骤（用于判断注入是否被跳过）。 */
export function hasWriteEnvStep(commandPlan: unknown): boolean {
  return readDeploymentCommandSteps(commandPlan).some((step) =>
    WRITE_ENV_STEP_KEYS.has(step.key),
  );
}
