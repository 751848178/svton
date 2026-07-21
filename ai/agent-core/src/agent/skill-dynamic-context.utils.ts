import type { ExecOptions, ExecResult, IPlatform, SandboxProfile } from '@svton/agent-platform';
import { formatUnknownErrorMessage } from '../utils/error-message.utils';

export interface SkillDynamicContextOptions {
  platform: IPlatform;
  workingDir: string;
  sandboxProfile?: SandboxProfile | null;
  sandboxRequired?: boolean;
}

export async function resolveSkillDynamicContext(
  instructions: string,
  options: SkillDynamicContextOptions,
): Promise<string> {
  const pattern = /!`([^`]+)`/g;
  const matches = Array.from(instructions.matchAll(pattern));
  if (matches.length === 0) return instructions;

  let result = instructions;
  for (const match of matches) {
    const replacement = await resolveDynamicCommand(match[1], options);
    result = result.replace(match[0], replacement);
  }
  return result;
}

async function resolveDynamicCommand(
  command: string,
  options: SkillDynamicContextOptions,
): Promise<string> {
  try {
    const execResult = await runDynamicCommand(command, options);
    return execResult.exitCode === 0
      ? execResult.stdout.trim()
      : `[Command failed (exit ${execResult.exitCode})]`;
  } catch (err) {
    return `[Error: ${formatUnknownErrorMessage(err)}]`;
  }
}

function runDynamicCommand(
  command: string,
  options: SkillDynamicContextOptions,
): Promise<ExecResult> {
  const execOptions: ExecOptions = { cwd: options.workingDir, timeout: 10000 };
  if (options.platform.sandbox && options.sandboxProfile) {
    return options.platform.sandbox.exec(command, execOptions, options.sandboxProfile);
  }

  const sandboxRequired = options.sandboxRequired ?? options.platform.capabilities?.sandboxing ?? false;
  if (sandboxRequired) {
    throw new Error('dynamic skill context requires sandbox execution, but sandbox is not available for this run.');
  }

  const processExec = options.platform.process?.exec?.bind(options.platform.process);
  if (!processExec) {
    throw new Error('dynamic skill context requires process execution, which is not available in this environment.');
  }
  return processExec(command, execOptions);
}
