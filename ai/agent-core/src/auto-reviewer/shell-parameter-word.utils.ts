import { normalizeShellWordToken } from './shell-command.utils';

export function shellParameterOperatorWordToken(token: string): string | null {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (char === "'" && quote !== '"') {
      quote = quote === "'" ? null : "'";
      continue;
    }
    if (char === '"' && quote !== "'") {
      quote = quote === '"' ? null : '"';
      continue;
    }
    if (char === '\\' && quote !== "'") {
      index += 1;
      continue;
    }
    if (char !== '$' || quote === "'") continue;

    const match = token.slice(index).match(/^\$\{[A-Za-z_][A-Za-z0-9_]*(?::[-=+]|[-=+])([^}]*)\}/);
    if (!match) continue;

    const prefix = normalizeShellWordToken(token.slice(0, index));
    const word = normalizeShellWordToken(match[1]);
    const suffix = normalizeShellWordToken(token.slice(index + match[0].length));
    return `${prefix}${word}${suffix}`;
  }

  return null;
}
