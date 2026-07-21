import { unquoteShellToken } from './shell-command.utils';

const ENV_OPTIONS_WITH_IGNORED_ARGUMENT = new Set(['-u', '--unset', '-C', '--chdir', '-P']);
const ENV_IGNORE_ENVIRONMENT_OPTION = '--ignore-environment';
const ENV_SPLIT_STRING_OPTION = '--split-string';
const ENV_UNSET_OPTION = '--unset';
const ENV_SHORT_OPTIONS_WITH_ARGUMENT = new Set(['u', 'C', 'P']);
const ENV_SPLIT_STRING_SHORT_OPTION = 'S';
const ENV_UNSET_SHORT_OPTION = 'u';

export interface EnvCommandEnvironmentEffect {
  preservesParentEnvironment: boolean;
  unsetNames: Set<string>;
}

export function envCommandEnvironmentEffect(tokens: string[]): EnvCommandEnvironmentEffect {
  const effect: EnvCommandEnvironmentEffect = {
    preservesParentEnvironment: true,
    unsetNames: new Set(),
  };
  let skipNext = false;
  let unsetNext = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (unsetNext) {
      if (token) effect.unsetNames.add(token);
      unsetNext = false;
      continue;
    }
    if (skipNext) {
      skipNext = false;
      continue;
    }

    if (token === '-' || token === '-i' || token === ENV_IGNORE_ENVIRONMENT_OPTION) {
      effect.preservesParentEnvironment = false;
      continue;
    }
    if (token === '-u' || token === ENV_UNSET_OPTION) {
      unsetNext = true;
      continue;
    }
    if (isLongOptionWithValue(token, ENV_UNSET_OPTION)) {
      effect.unsetNames.add(token.slice(`${ENV_UNSET_OPTION}=`.length));
      continue;
    }
    const inlineUnset = shortUnsetInlineArgument(token);
    if (inlineUnset !== null) {
      effect.unsetNames.add(inlineUnset);
      continue;
    }
    if (shortOptionApplies(token, 'i')) effect.preservesParentEnvironment = false;

    if (token === '-S' || token === ENV_SPLIT_STRING_OPTION) break;
    if (isLongOptionWithValue(token, ENV_SPLIT_STRING_OPTION)) break;
    if (token.startsWith('-S') && token.length > 2) break;
    if (token.includes('=')) continue;
    if (token.startsWith('-')) {
      skipNext = ENV_OPTIONS_WITH_IGNORED_ARGUMENT.has(token) || shortOptionGroupNeedsArgument(token);
      continue;
    }
    break;
  }

  return effect;
}

function isLongOptionWithValue(token: string, option: string): boolean {
  return token.startsWith(`${option}=`);
}

function shortOptionArgumentIndex(token: string): number {
  if (!token.startsWith('-') || token.startsWith('--')) return -1;

  return [...token.slice(1)].findIndex((char) => ENV_SHORT_OPTIONS_WITH_ARGUMENT.has(char));
}

function shortOptionApplies(token: string, option: string): boolean {
  const optionIndex = token.startsWith('-') && !token.startsWith('--')
    ? [...token.slice(1)].indexOf(option)
    : -1;
  const argumentIndex = shortOptionArgumentIndex(token);
  return optionIndex >= 0 && (argumentIndex < 0 || optionIndex <= argumentIndex);
}

function shortUnsetInlineArgument(token: string): string | null {
  const argumentIndex = shortOptionArgumentIndex(token);
  if (argumentIndex < 0) return null;

  const optionChars = [...token.slice(1)];
  if (optionChars[argumentIndex] !== ENV_UNSET_SHORT_OPTION) return null;

  return argumentIndex < optionChars.length - 1 ? optionChars.slice(argumentIndex + 1).join('') : null;
}

function shortOptionGroupNeedsArgument(token: string): boolean {
  const argumentIndex = shortOptionArgumentIndex(token);
  return argumentIndex >= 0 && argumentIndex === token.length - 2;
}
