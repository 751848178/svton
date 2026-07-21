import { normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import type { StaticShellAssignment } from './shell-static-assignment.types';
import { formatStaticPrintfValue } from './shell-static-printf-format.utils';
import { staticShellWordValue } from './shell-static-variable-command.utils';

export function staticPrintfAssignment(statement: string): StaticShellAssignment | null {
  const tokens = splitUnquotedIfsExpansionTokens(splitShellWords(statement));
  if (normalizeShellWordToken(tokens[0] ?? '') !== 'printf') return null;
  if (normalizeShellWordToken(tokens[1] ?? '') !== '-v') return null;

  const name = normalizeShellWordToken(tokens[2] ?? '');
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;

  return {
    name,
    readonly: false,
    value: staticPrintfValue(tokens[3], tokens.slice(4)),
  };
}

function staticPrintfValue(formatToken: string | undefined, argTokens: string[]): string | null {
  if (!formatToken) return null;

  const format = staticShellWordValue(formatToken);
  const args = argTokens.map(staticShellWordValue);
  if (format === null || args.includes(null)) return null;

  return formatStaticPrintfValue(format, args as string[]);
}
