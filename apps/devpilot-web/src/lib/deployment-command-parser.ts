/**
 * 部署命令计划解析（纯函数，跨域共享）
 *
 * 单一职责：从 DeploymentRun.commandPlan（后端 Json? 标量）解析出
 *   1) 命令步骤（checkout/build/write_env/deploy/health_check/cleanup_env）；
 *   2) write_env 步骤里将写入 .env 的变量 KEY（脱敏真值只给 KEY 名）。
 *
 * 背景（见 research/r2-issue234 §1.3、r3-deploy-flow-interaction）：
 * - 注入的真值从不落库（持久化的是 `KEY=***REDACTED***`，真值只在运行期 secretEnv 生效），
 *   因此前端只能安全展示 KEY 名；
 * - commandPlan 形如 { steps: [{key,label,command,cwd,required}] } 或直接是数组；
 * - write_env 步骤 command 形如：
 *     cat > .env <<'DEVPLOT_ENV_EOF'\nDATABASE_URL=***REDACTED***\n...\nDEVPLOT_ENV_EOF
 *
 * 原实现散落在 projects/[id]/utils/deployment-config.ts（readDeploymentCommandSteps）
 * 与 projects/[id]/utils/command-plan-env-parser.ts（extractInjectedEnvKeys），
 * applications/ 域需要复用但不应跨路由导入，故抽取到共享 lib。
 */

export interface DeploymentCommandStep {
  key: string;
  label: string;
  command: string;
  cwd: string;
  required: boolean;
}

/** 判断未知值是否为合法命令步骤。 */
export function isDeploymentCommandStep(
  value: unknown,
): value is { key: string; label: string; command?: string; cwd?: string; required?: boolean } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const step = value as Record<string, unknown>;
  return typeof step.key === 'string' && typeof step.label === 'string';
}

/**
 * 从 commandPlan 读取命令步骤数组。
 *
 * 兼容两种后端形态：{steps:[...]} 对象，或直接是数组；非法/空返回 []。
 */
export function readDeploymentCommandSteps(commandPlan: unknown): DeploymentCommandStep[] {
  const steps = Array.isArray(commandPlan)
    ? commandPlan
    : typeof commandPlan === 'object' &&
        commandPlan !== null &&
        Array.isArray((commandPlan as { steps?: unknown }).steps)
      ? (commandPlan as { steps: unknown[] }).steps
      : [];
  return steps.filter(isDeploymentCommandStep).map((step) => ({
    key: step.key,
    label: step.label,
    command: typeof step.command === 'string' ? step.command : '',
    cwd: typeof step.cwd === 'string' ? step.cwd : '',
    required: step.required === true,
  }));
}

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
