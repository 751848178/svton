import { catHereDocOutputToken } from './cat-output-token.utils';
import { ddHereDocOutputToken } from './dd-output-token.utils';
import { teeHereDocOutputToken } from './tee-output-token.utils';

const STATIC_STDIN_HEREDOC_COMMAND_SUBSTITUTION_PATTERN = /\$\(((?:command\s+)?(?:cat|dd|tee)[^\n]*<<-?[^\n]*\n[\s\S]*?\n\t*[A-Za-z_][A-Za-z0-9_]*\n?)\)/g;

export function normalizeBashEnvStaticCommandOutput(command: string): string {
  return command.replace(STATIC_STDIN_HEREDOC_COMMAND_SUBSTITUTION_PATTERN, (match, innerCommand: string) => {
    const output = catHereDocOutputToken(innerCommand)
      ?? ddHereDocOutputToken(innerCommand)
      ?? teeHereDocOutputToken(innerCommand);
    return output === null ? match : singleQuoteShellToken(output);
  });
}

function singleQuoteShellToken(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
