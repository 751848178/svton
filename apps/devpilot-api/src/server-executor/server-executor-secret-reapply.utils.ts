/**
 * 执行边界重应用 $DEVPILOT_* 秘密的纯工具（F383 P0-A）。
 *
 * 背景：队列路径把 SEJ 的 inputSnapshot 持久化（stripSecretEnv 已剥离 secretEnvExport），
 * 队列 worker 从持久化快照 rehydrate 时丢失了内存里的真实秘密。本工具在 rehydrate 之后、
 * SSH live 执行之前重新解析：扫描 steps[].command 里的 $DEVPILOT_<KEY> 占位引用，
 * 调用调用方提供的解析器拿到真实值，写回 step.secretEnvExport（仅内存，再次落库前仍会被
 * stripSecretEnv 剥离）。真实秘密因此只在执行边界的内存中存在，绝不进入持久化模型。
 */
import type { ServerExecutionInput, ServerCommandStep } from "./server-executor.types";
import { extractDevpilotVarRefs, buildSecretEnvExport } from "../release-orchestration/utils/release-credential-injection.utils";

/** 调用方提供的真实秘密解析器：(teamId, projectId, environmentId) → {KEY: 明文}。 */
export type ResolveDevpilotSecretsFn = (
  teamId: string,
  projectId: string | null | undefined,
  environmentId: string | null | undefined,
) => Promise<Record<string, string>>;

/**
 * 若 input.steps 的 command 含 $DEVPILOT_* 引用，调用 resolver 解析真实值并写回
 * step.secretEnvExport。返回新 input（无引用时原样返回，零开销）。
 * projectId/environmentId 从 input.metadata 读取（server-command 适配器已写入）。
 */
export async function reapplySecretEnvExport(
  input: ServerExecutionInput,
  resolver: ResolveDevpilotSecretsFn,
): Promise<ServerExecutionInput> {
  // 收集所有步骤引用的变量名；无引用则直接返回。
  const allRefs: string[] = [];
  for (const step of input.steps) {
    if (step.command) allRefs.push(...extractDevpilotVarRefs(step.command));
  }
  if (allRefs.length === 0) return input;

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

  const resolved = await resolver(input.teamId, projectId, environmentId);
  const steps = input.steps.map((step) => {
    if (!step.command) return step;
    const refs = extractDevpilotVarRefs(step.command);
    if (refs.length === 0) return step;
    const secretEnvExport = buildSecretEnvExport(refs, resolved);
    if (Object.keys(secretEnvExport).length === 0) return step;
    return { ...step, secretEnvExport } as ServerCommandStep;
  });
  return { ...input, steps };
}
