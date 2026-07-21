import { getShellTokenBasename, normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { splitShellPipelineSegments } from './shell-pipeline-command.utils';
import type {
  StaticShellCommandStatus,
  StaticShellCommandStatusOptions,
} from './shell-static-command-status.types';

export function cloneStaticShellCommandStatusOptions(
  options: StaticShellCommandStatusOptions = {},
): StaticShellCommandStatusOptions {
  return {
    errexit: options.errexit === true,
    errexitSuppressed: options.errexitSuppressed === true,
    allexport: options.allexport === true,
    errtrace: options.errtrace === true,
    functrace: options.functrace === true,
    pipefail: options.pipefail === true,
  };
}

export function applyStaticShellOptionState(
  statement: string,
  options: StaticShellCommandStatusOptions,
): boolean {
  if (splitShellPipelineSegments(statement).length > 1) return false;

  const values = staticShellOptionValues(splitShellWords(statement));
  if (values === null) return false;
  Object.assign(options, values);
  return true;
}

export function staticShellOptionCommandStatus(tokens: string[]): StaticShellCommandStatus {
  return staticShellOptionValues(tokens) === null ? null : true;
}

function staticShellOptionValues(tokens: string[]): StaticShellCommandStatusOptions | null {
  const optionTokens = shellOptionCommandTokens(tokens);
  if (getShellTokenBasename(optionTokens[0] ?? '') !== 'set') return null;

  const values: StaticShellCommandStatusOptions = {};
  for (let index = 1; index < optionTokens.length; index += 1) {
    const token = normalizeShellWordToken(optionTokens[index]);
    if (token === '-o' || token === '+o') {
      const option = normalizeShellWordToken(optionTokens[index + 1] ?? '');
      applyNamedShellOption(values, option, token === '-o');
      index += 1;
      continue;
    }

    applyShortShellOptions(values, token);
  }

  return Object.keys(values).length > 0 ? values : null;
}

function applyNamedShellOption(
  values: StaticShellCommandStatusOptions,
  option: string,
  enabled: boolean,
): void {
  if (option === 'errexit') values.errexit = enabled;
  if (option === 'allexport') values.allexport = enabled;
  if (option === 'errtrace') values.errtrace = enabled;
  if (option === 'functrace') values.functrace = enabled;
  if (option === 'pipefail') values.pipefail = enabled;
}

function applyShortShellOptions(
  values: StaticShellCommandStatusOptions,
  token: string,
): void {
  if (!/^[-+][A-Za-z]+$/.test(token)) return;
  if (token.includes('a')) values.allexport = token.startsWith('-');
  if (token.includes('E')) values.errtrace = token.startsWith('-');
  if (token.includes('e')) values.errexit = token.startsWith('-');
  if (token.includes('T')) values.functrace = token.startsWith('-');
}

function shellOptionCommandTokens(tokens: string[]): string[] {
  const commandIndex = tokens.findIndex((token) => !isAssignmentToken(token));
  if (commandIndex < 0) return [];

  const commandTokens = splitUnquotedIfsExpansionTokens(tokens.slice(commandIndex));
  const wrapper = getShellTokenBasename(commandTokens[0] ?? '');
  if (wrapper === 'builtin') return builtinWrappedCommandTokens(commandTokens);
  if (wrapper === 'command') return commandWrappedCommandTokens(commandTokens);
  return commandTokens;
}

function builtinWrappedCommandTokens(tokens: string[]): string[] {
  return tokens.length > 1 && !normalizeShellWordToken(tokens[1]).startsWith('-')
    ? tokens.slice(1)
    : [];
}

function commandWrappedCommandTokens(tokens: string[]): string[] {
  let commandIndex = 1;
  for (; commandIndex < tokens.length; commandIndex += 1) {
    const option = normalizeShellWordToken(tokens[commandIndex]);
    if (option === '--') return tokens.slice(commandIndex + 1);
    if (!option.startsWith('-')) break;
    if (option !== '-p') return [];
  }

  return tokens.slice(commandIndex);
}

function isAssignmentToken(token: string): boolean {
  const separator = token.indexOf('=');
  if (separator <= 0) return false;
  return /^[A-Za-z_]\w*$/.test(token.slice(0, separator));
}
