import {
  firstNonOptionToken,
  literalCommandOutputTokenResult,
} from './literal-command-output.utils';
import {
  getShellTokenBasename,
  splitShellWords,
  unquoteShellToken,
} from './shell-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { pwdCommandOutputToken } from './pwd-output-token.utils';

export function staticCommandSubstitutionOutputToken(command: string, workingDir = ''): string | null {
  const pwdToken = pwdCommandOutputToken(command, workingDir);
  if (pwdToken) return stripTrailingCommandSubstitutionNewlines(pwdToken);

  const locatorToken = commandLocatorOutputToken(command);
  if (locatorToken) return stripTrailingCommandSubstitutionNewlines(locatorToken);

  const literalToken = literalCommandOutputTokenResult(command)?.token;
  return literalToken === undefined
    ? null
    : stripTrailingCommandSubstitutionNewlines(literalToken);
}

function stripTrailingCommandSubstitutionNewlines(value: string): string {
  return value.replace(/\n+$/, '');
}

function commandLocatorOutputToken(command: string): string {
  const tokens = splitShellWords(
    unwrapShellGroupCommand(command, { stripTrailingTerminator: true }),
  );
  const first = tokens[0];
  if (!first) return '';

  const firstName = getShellTokenBasename(first);
  if (firstName === 'command') return commandBuiltinLookupToken(tokens);
  if (firstName === 'which') return firstNonOptionToken(tokens, 1);
  if (firstName === 'type') return typeLookupToken(tokens);

  return '';
}

function commandBuiltinLookupToken(tokens: string[]): string {
  let lookupRequested = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token.startsWith('-')) {
      lookupRequested ||= token.includes('v');
      continue;
    }

    return lookupRequested ? tokens[index] : '';
  }

  return '';
}

function typeLookupToken(tokens: string[]): string {
  let pathLookupRequested = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (token.startsWith('-')) {
      pathLookupRequested ||= token.includes('p') || token.includes('P');
      continue;
    }

    return pathLookupRequested ? tokens[index] : '';
  }

  return '';
}
