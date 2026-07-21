import {
  type ShellPositionalArguments,
  shellPositionalTargetTokens,
} from './shell-positional-parameter.utils';

function positionalReplacement(marker: string, positionals: ShellPositionalArguments): string | null {
  const targets = shellPositionalTargetTokens(marker, positionals);
  return targets.length > 0 ? targets.join(' ') : null;
}

function bracedPositionalMarker(command: string, index: number): { marker: string; endIndex: number } | null {
  const match = command.slice(index).match(/^\$\{(?:\d+(?::?[-+][^}]*)?|[@*])\}/);
  return match ? { marker: match[0], endIndex: index + match[0].length } : null;
}

function positionalMarker(command: string, index: number): { marker: string; endIndex: number } | null {
  const braced = bracedPositionalMarker(command, index);
  if (braced) return braced;

  const match = command.slice(index).match(/^\$(\d+|[@*])/);
  return match ? { marker: match[0], endIndex: index + match[0].length } : null;
}

export function expandShellCommandStringPositionals(
  command: string,
  positionals: ShellPositionalArguments,
): string {
  let expanded = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === '\\') {
      expanded += char;
      if (command[index + 1]) {
        index += 1;
        expanded += command[index];
      }
      continue;
    }

    if (char === '"' || char === "'") {
      if (quote === char) quote = null;
      else if (!quote) quote = char;
      expanded += char;
      continue;
    }

    const marker = quote === "'" ? null : positionalMarker(command, index);
    const replacement = marker ? positionalReplacement(marker.marker, positionals) : null;
    if (marker && replacement !== null) {
      expanded += replacement;
      index = marker.endIndex - 1;
      continue;
    }

    expanded += char;
  }

  return expanded;
}
