import { literalCommandOutputToken } from './literal-command-output.utils';
import {
  inputProcessSubstitutionCommandsForFdRedirect,
} from './process-substitution.utils';
import { inputProcessSubstitutionCommandsForStdinRedirect } from './stdin-process-substitution-command.utils';
import { hereDocCommandStringsForFd } from './shell-here-doc-command.utils';
import { scriptInputWordCommandString } from './shell-script-input-word.utils';
import { staticAssignmentCommandStrings } from './shell-static-assignment-command.utils';
import { shellFdPathNumber } from './shell-stdin-path.utils';

export function bashEnvFdStartupCommandStrings(
  statement: string,
  startupValue: string,
  sourceCommand = statement,
): string[] {
  const fd = shellFdPathNumber(startupValue);
  if (fd === null) return [];
  if (fd === 0) return bashEnvStdinStartupCommandStrings(statement, sourceCommand);

  const scripts = inputProcessSubstitutionCommandsForFdRedirect(statement, fd)
    .map(literalCommandOutputToken)
    .concat(fdHereStringScriptCommandStrings(statement, fd))
    .concat(hereDocCommandStringsForFd(sourceCommand, fd))
    .filter(Boolean);

  return scripts.concat(scripts.flatMap(staticAssignmentCommandStrings));
}

function bashEnvStdinStartupCommandStrings(statement: string, sourceCommand: string): string[] {
  const scripts = inputProcessSubstitutionCommandsForStdinRedirect(statement)
    .map(literalCommandOutputToken)
    .concat(fdHereStringScriptCommandStrings(statement, 0))
    .concat(defaultHereStringScriptCommandStrings(statement))
    .concat(hereDocCommandStringsForFd(sourceCommand, 0))
    .concat(hereDocCommandStringsForFd(sourceCommand, null))
    .filter(Boolean);

  return scripts.concat(scripts.flatMap(staticAssignmentCommandStrings));
}

function fdHereStringScriptCommandStrings(statement: string, fd: number): string[] {
  return hereStringScriptCommandStrings(statement, `${fd}<<<`);
}

function defaultHereStringScriptCommandStrings(statement: string): string[] {
  return hereStringScriptCommandStrings(statement, '<<<');
}

function hereStringScriptCommandStrings(statement: string, marker: string): string[] {
  const scripts: string[] = [];
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (!statement.startsWith(marker, index) || !hasShellBoundaryBefore(statement, index)) continue;

    const word = readShellWord(statement, index + marker.length);
    const script = scriptInputWordCommandString(word.token);
    if (script) scripts.push(script);
    index = word.endIndex;
  }

  return scripts;
}

function hasShellBoundaryBefore(statement: string, index: number): boolean {
  const before = statement[index - 1] ?? '';
  return !before || /[\s|;&(]/.test(before);
}

function readShellWord(statement: string, startIndex: number): { token: string; endIndex: number } {
  let index = startIndex;
  let token = '';
  let quote: '"' | "'" | null = null;

  while (/\s/.test(statement[index] ?? '')) index += 1;

  for (; index < statement.length; index += 1) {
    const char = statement[index];
    if (quote) {
      token += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      token += char;
      continue;
    }
    if (char === '\\') {
      token += char;
      if (statement[index + 1]) token += statement[++index];
      continue;
    }
    if (/\s/.test(char) || ['|', ';', '&', '<', '>'].includes(char)) break;
    token += char;
  }

  return { token, endIndex: index };
}
