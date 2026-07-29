/**
 * 队列边界重应用部署 .env 秘密（F383 部署主链补齐）。
 *
 * 背景：部署 `write_env` 步骤在 createRun 时把真实 DB/Redis/JWT 值放进 step.secretEnv
 * （内存），持久化前被 stripSecretEnv 剥离。队列 worker 从 inputSnapshot rehydrate 时
 * secretEnv 丢失 → SSH live 渲染回退到脱敏 command → .env 写入字面量 ***REDACTED***。
 *
 * 修复：在 rehydrate 后、SSH live 执行前，识别 `write_env` 步骤（command 含 heredoc 且值
 * 脱敏），从脱敏 command 抽取键名，用与 $DEVPILOT_* 同源的部署秘密解析器重新解析，重建
 * step.secretEnv 与真实 heredoc 命令。真实值只在执行边界内存存在，落库前仍被 stripSecretEnv 剥离。
 *
 * 仅处理 key === "write_env" 的步骤；无此类步骤或解析失败时原样返回（零开销）。
 */
import type { ServerExecutionInput, ServerCommandStep } from "./server-executor.types";
import type { ResolveDevpilotSecretsFn } from "./server-executor-secret-reapply.utils";

/** 从 write_env 步骤的脱敏 heredoc command 抽取键名（KEY=... 行的 KEY 部分）。 */
function extractEnvKeysFromWriteEnvCommand(command: string | undefined): string[] {
  if (!command) return [];
  const keys: string[] = [];
  for (const line of command.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m && m[1] !== "cat") keys.push(m[1]);
  }
  return keys;
}

/**
 * 若 input 含 write_env 步骤且缺少 secretEnv，调用 resolver 重新解析部署 .env 秘密并
 * 重建 step.secretEnv + 真实 heredoc 命令。无 write_env 步骤或无 resolver 时原样返回。
 */
export async function reapplyDeploymentEnvWriteSecrets(
  input: ServerExecutionInput,
  resolver: ResolveDevpilotSecretsFn,
): Promise<ServerExecutionInput> {
  const writeEnvSteps = input.steps.filter(
    (s) => s.key === "write_env" && !s.secretEnv,
  );
  if (writeEnvSteps.length === 0) return input;

  const meta = (input.metadata ?? {}) as Record<string, unknown>;
  const projectId =
    (typeof meta.projectId === "string" && meta.projectId) ||
    (typeof meta.sourceMetadata === "object" && meta.sourceMetadata !== null
      ? ((meta.sourceMetadata as Record<string, unknown>).projectId as string | undefined)
      : undefined);
  const environmentId =
    (typeof meta.environmentId === "string" && meta.environmentId) ||
    (typeof meta.sourceMetadata === "object" && meta.sourceMetadata !== null
      ? ((meta.sourceMetadata as Record<string, unknown>).environmentId as string | undefined)
      : undefined);

  // 一次解析拿回全部部署环境秘密；按各 write_env 步骤的键名子集挑选。
  const resolved = await resolver(input.teamId, projectId, environmentId);

  let changed = false;
  const steps = input.steps.map((step): ServerCommandStep => {
    if (step.key !== "write_env" || step.secretEnv) return step;
    const keys = extractEnvKeysFromWriteEnvCommand(step.command);
    if (keys.length === 0) return step;
    const secretEnv: Record<string, string> = {};
    for (const k of keys) {
      if (typeof resolved[k] === "string") secretEnv[k] = resolved[k];
    }
    if (Object.keys(secretEnv).length === 0) return step;
    changed = true;
    // 只回填 step.secretEnv；绝不改写 step.command（脱敏 command 仍用于持久化/策略匹配）。
    // SSH live 脚本渲染器在 step.secretEnv 存在时会用 renderEnvWriteCommandReal 生成真实
    // heredoc（仅内存），真实值因此不进入任何持久化字段。
    return {
      ...step,
      secretEnv,
    } as ServerCommandStep;
  });

  return changed ? { ...input, steps } : input;
}
