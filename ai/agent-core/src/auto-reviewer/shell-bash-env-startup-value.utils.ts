import { embeddedCommandSubstitutionCommands, embeddedCommandSubstitutionOutputToken } from './command-substitution-embedded-token.utils';
import { staticCommandSubstitutionOutputToken } from './command-substitution-command-output.utils';
import { readArithmeticExpansionToken } from './shell-arithmetic-expansion-token.utils';
import { staticArithmeticValue } from './shell-static-arithmetic-value.utils';
import { bashEnvProtectedValueHasShellSyntax, type ProtectedStartupValue, substituteBashEnvStartupVariables } from './shell-bash-env-startup-protected-value.utils';
import { expandBashStartupTilde } from './shell-bash-env-startup-filename.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

export interface BashEnvStartupExpansion {
  value: string;
  commands: string[];
  hasUnresolvedParameterExpansion: boolean;
}

export function bashEnvEnvironmentVariables(
  variables: Map<string, string>,
  exportedNames: Set<string>,
): Map<string, string> {
  return new Map(
    [...variables.entries()].filter(([name]) => exportedNames.has(name)),
  );
}

export function expandBashEnvStartupValue(
  value: string,
  variables: Map<string, string>,
  expandVariables: boolean,
  workingDir = '',
): string {
  return expandBashEnvStartup(value, variables, expandVariables, workingDir).value;
}

export function expandBashEnvStartup(
  value: string,
  variables: Map<string, string>,
  expandVariables: boolean,
  workingDir = '',
): BashEnvStartupExpansion {
  const expanded = expandBashEnvStartupPieces(value, variables, expandVariables, workingDir);
  return {
    value: expanded.value,
    commands: expanded.commands,
    hasUnresolvedParameterExpansion: expanded.hasProtectedShellSyntax
      || bashEnvStartupValueHasUnresolvedParameterExpansion(expanded.value),
  };
}

function expandBashEnvStartupPieces(
  value: string,
  variables: Map<string, string>,
  expandVariables: boolean,
  workingDir: string,
): BashEnvStartupExpansionPieces {
  if (!expandVariables) {
    return expandBashStartupFilenameExpansionPass({
      value,
      hasProtectedShellSyntax: false,
    }, variables, workingDir);
  }
  return expandBashStartupFilenameExpansionPass(
    substituteBashEnvStartupVariables(value, variables),
    variables,
    workingDir,
  );
}

export function bashEnvValuePreservesStartupExpansion(rawValue: string): boolean {
  return rawValue.includes("'") || /\\[$A-Za-z_{]/.test(rawValue);
}

export function bashEnvStartupValueHasUnresolvedParameterExpansion(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '\\') {
      if (value[index + 1]) index += 1;
      continue;
    }
    if (char !== '$') continue;
    if (value[index + 1] === '(') continue;
    if (/[A-Za-z0-9_{}!#?*@$-]/.test(value[index + 1] ?? '')) return true;
  }

  return false;
}

interface BashEnvStartupExpansionPieces {
  value: string;
  commands: string[];
  hasProtectedShellSyntax: boolean;
}

function expandBashStartupFilenameExpansionPass(
  protectedValue: ProtectedStartupValue,
  variables: Map<string, string>,
  workingDir: string,
): BashEnvStartupExpansionPieces {
  const chunks = protectedValue.value.split(/(\x01[^\x02]*\x02)/);
  const commands: string[] = [];
  let value = '';
  let hasProtectedShellSyntax = protectedValue.hasProtectedShellSyntax;

  for (const chunk of chunks) {
    if (!chunk) continue;
    if (chunk.startsWith('\x01') && chunk.endsWith('\x02')) {
      value += chunk.slice(1, -1);
      continue;
    }

    commands.push(...embeddedCommandSubstitutionCommands(chunk));
    const commandExpanded = embeddedCommandSubstitutionOutputToken(
      chunk,
      (command) => staticCommandSubstitutionOutputToken(substituteStaticShellVariables(command, variables), workingDir),
    ) ?? chunk;
    const arithmeticExpanded = expandStaticArithmeticExpansions(commandExpanded, variables);
    const defaults = expandUnsetDefaultParameters(arithmeticExpanded, variables, workingDir);
    value += defaults.value;
    commands.push(...defaults.commands);
    hasProtectedShellSyntax ||= defaults.hasProtectedShellSyntax;
  }

  return {
    value: expandBashStartupTilde(value, variables, workingDir),
    commands,
    hasProtectedShellSyntax,
  };
}

function expandUnsetDefaultParameters(
  value: string,
  variables: Map<string, string>,
  workingDir: string,
): BashEnvStartupExpansionPieces {
  const commands: string[] = [];
  let output = '';
  let hasProtectedShellSyntax = false;

  for (let index = 0; index < value.length; index += 1) {
    const replacement = readUnsetDefaultParameterReplacement(value, index, variables, workingDir);
    if (replacement) {
      output += replacement.value;
      commands.push(...replacement.commands);
      hasProtectedShellSyntax ||= replacement.hasProtectedShellSyntax;
      index += replacement.length - 1;
      continue;
    }
    output += value[index];
  }

  return { value: output, commands, hasProtectedShellSyntax };
}

function readUnsetDefaultParameterReplacement(
  value: string,
  index: number,
  variables: Map<string, string>,
  workingDir: string,
): BashEnvStartupExpansionPieces & { length: number } | null {
  if (value[index] !== '$' || value[index + 1] !== '{') return null;

  const match = value.slice(index + 2).match(/^([A-Za-z_]\w*)(:-|:=|-|=)/);
  if (!match) return null;

  const name = match[1];
  const operator = match[2];
  const fallbackStart = index + 2 + name.length + operator.length;
  const endIndex = value.indexOf('}', fallbackStart);
  if (endIndex === -1) return null;

  const knownValue = variables.get(name);
  const usesFallback = knownValue === undefined
    || ((operator === ':-' || operator === ':=') && knownValue === '');
  const fallback = value.slice(fallbackStart, endIndex);
  const next = usesFallback
    ? expandBashEnvStartupPieces(fallback, variables, true, workingDir)
    : {
      value: knownValue,
      commands: [],
      hasProtectedShellSyntax: bashEnvProtectedValueHasShellSyntax(knownValue),
    };
  if (usesFallback && (operator === ':=' || operator === '=')) variables.set(name, next.value);
  return { ...next, length: endIndex - index + 1 };
}

function expandStaticArithmeticExpansions(value: string, variables: Map<string, string>): string {
  let output = '';

  for (let index = 0; index < value.length; index += 1) {
    const expansion = readArithmeticExpansionToken(value, index);
    if (!expansion) {
      output += value[index];
      continue;
    }

    const expanded = staticArithmeticValue(expansion.expression, variables);
    output += expanded ?? value.slice(index, expansion.endIndex + 1);
    index = expansion.endIndex;
  }

  return output;
}
