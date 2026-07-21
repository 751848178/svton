import { staticCommandSubstitutionOutputToken } from './command-substitution-command-output.utils';
import { unquoteShellToken } from './shell-command.utils';
import { readArithmeticExpansionToken } from './shell-arithmetic-expansion-token.utils';

type StaticCommandSubstitutionOutput = (command: string) => string | null;

export function embeddedCommandSubstitutionOutputToken(
  token: string,
  outputToken: StaticCommandSubstitutionOutput = staticCommandSubstitutionOutputToken,
): string | null {
  const trimmed = token.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return null;

  const unquoted = unquoteShellToken(trimmed);
  let output = '';
  let changed = false;

  for (let index = 0; index < unquoted.length; index += 1) {
    if (unquoted[index] === '\\' && unquoted[index + 1]) {
      output += `${unquoted[index]}${unquoted[index + 1]}`;
      index += 1;
      continue;
    }

    const arithmeticExpansion = readArithmeticExpansionToken(unquoted, index);
    if (arithmeticExpansion) {
      const commands = embeddedCommandSubstitutionCommands(arithmeticExpansion.expression);
      if (commands.length === 0) {
        output += unquoted.slice(index, arithmeticExpansion.endIndex + 1);
      } else {
        const expanded = embeddedCommandSubstitutionOutputToken(arithmeticExpansion.expression, outputToken);
        if (expanded === null) return null;
        output += `$(( ${expanded} ))`;
        changed = true;
      }
      index = arithmeticExpansion.endIndex;
      continue;
    }

    const dollarCommand = readDollarCommandSubstitution(unquoted, index);
    if (dollarCommand) {
      const value = outputToken(dollarCommand.command);
      if (value === null) return null;
      output += value;
      changed = true;
      index = dollarCommand.endIndex;
      continue;
    }

    const backtickCommand = readBacktickCommandSubstitution(unquoted, index);
    if (backtickCommand) {
      const value = outputToken(backtickCommand.command);
      if (value === null) return null;
      output += value;
      changed = true;
      index = backtickCommand.endIndex;
      continue;
    }

    output += unquoted[index];
  }

  return changed ? output : null;
}

export function embeddedCommandSubstitutionCommands(token: string): string[] {
  const unquoted = unquoteShellToken(token.trim());
  const commands: string[] = [];

  for (let index = 0; index < unquoted.length; index += 1) {
    if (unquoted[index] === '\\' && unquoted[index + 1]) {
      index += 1;
      continue;
    }

    const arithmeticExpansion = readArithmeticExpansionToken(unquoted, index);
    if (arithmeticExpansion) {
      commands.push(...embeddedCommandSubstitutionCommands(arithmeticExpansion.expression));
      index = arithmeticExpansion.endIndex;
      continue;
    }

    const dollarCommand = readDollarCommandSubstitution(unquoted, index);
    if (dollarCommand) {
      commands.push(dollarCommand.command);
      index = dollarCommand.endIndex;
      continue;
    }

    const backtickCommand = readBacktickCommandSubstitution(unquoted, index);
    if (backtickCommand) {
      commands.push(backtickCommand.command);
      index = backtickCommand.endIndex;
    }
  }

  return commands;
}

export function readDollarCommandSubstitution(
  token: string,
  index: number,
): { command: string; endIndex: number } | null {
  if (token[index] !== '$' || token[index + 1] !== '(') return null;

  const endIndex = dollarCommandSubstitutionEndIndex(token, index + 2);
  return endIndex < 0
    ? null
    : { command: token.slice(index + 2, endIndex), endIndex };
}

function dollarCommandSubstitutionEndIndex(token: string, startIndex: number): number {
  let quote: '"' | "'" | null = null;
  let depth = 1;
  let groupDepth = 0;

  for (let index = startIndex; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      if (char === quote) quote = null;
      if (quote === '"' && char === '\\' && token[index + 1]) index += 1;
      continue;
    }

    if (char === '\\') {
      if (token[index + 1]) index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '$' && token[index + 1] === '(') {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === '(') {
      groupDepth += 1;
      continue;
    }
    if (char === ')') {
      if (groupDepth > 0) {
        groupDepth -= 1;
        continue;
      }
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

export function readBacktickCommandSubstitution(
  token: string,
  index: number,
): { command: string; endIndex: number } | null {
  if (token[index] !== '`') return null;

  for (let endIndex = index + 1; endIndex < token.length; endIndex += 1) {
    if (token[endIndex] === '\\' && token[endIndex + 1]) {
      endIndex += 1;
      continue;
    }
    if (token[endIndex] === '`') {
      return { command: token.slice(index + 1, endIndex), endIndex };
    }
  }

  return null;
}
