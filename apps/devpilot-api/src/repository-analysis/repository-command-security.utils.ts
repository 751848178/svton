import { DetectedCommandSet } from './repository-parser.types';
import { redactRepositoryText } from './repository-analysis-redact.utils';

export type SecureRepositoryCommands = {
  commands: DetectedCommandSet;
  warnings: string[];
};

export function secureRepositoryCommands(
  source: DetectedCommandSet,
): SecureRepositoryCommands {
  const commands: DetectedCommandSet = {};
  const warnings: string[] = [];
  for (const key of Object.keys(source) as Array<keyof DetectedCommandSet>) {
    const command = source[key];
    if (!command) continue;
    if (redactRepositoryText(command) !== command) {
      warnings.push(`${key} 命令包含凭据或秘密赋值，已从可应用建议中移除。`);
      continue;
    }
    commands[key] = command;
  }
  return { commands, warnings };
}
