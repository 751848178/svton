import { getShellTokenBasename } from './shell-command.utils';
import {
  jsStaticStateBefore,
  type JsStaticState,
} from './javascript-static-value.utils';
import { readJsStaticStringExpression } from './javascript-static-string.utils';

const JS_NAME_PATTERN = '[A-Za-z_$][A-Za-z0-9_$]*';
const NODE_SHELL_BASENAMES = new Set(['ash', 'bash', 'dash', 'sh', 'zsh']);
const TRUE_SHELL_OPTION_PATTERN = /(?:^|[,{])\s*(?:shell|["']shell["'])\s*:\s*true\b/;
const SHELL_OPTION_VALUE_PATTERN = /(?:^|[,{])\s*(?:shell|["']shell["'])\s*:\s*/g;

export function nodeCallUsesShellOption(code: string, callStart: number, callEnd: number): boolean {
  const callArgs = code.slice(callStart, callEnd);
  const state = jsStaticStateBefore(code, callStart);
  if (hasStaticShellOption(callArgs, state)) return true;

  const staticShellNames = staticShellOptionNames(state);
  return shellOptionReferencesStaticShell(callArgs, staticShellNames);
}

function hasStaticShellOption(callArgs: string, state: JsStaticState): boolean {
  if (TRUE_SHELL_OPTION_PATTERN.test(callArgs)) return true;

  for (const match of callArgs.matchAll(SHELL_OPTION_VALUE_PATTERN)) {
    const value = readJsStaticStringExpression(
      callArgs,
      Number(match.index) + match[0].length,
      (name) => state.strings.get(name),
      shellOptionValueBoundary,
    );
    if (value && isNodeShellValue(value.value)) {
      return true;
    }
  }

  return false;
}

function staticShellOptionNames(state: JsStaticState): Set<string> {
  return new Set([...state.strings.entries()]
    .filter(([, value]) => isNodeShellValue(value))
    .map(([name]) => name));
}

function shellOptionReferencesStaticShell(callArgs: string, staticShellNames: Set<string>): boolean {
  for (const name of staticShellNames) {
    const escaped = escapePattern(name);
    const valueReference = new RegExp(
      `(?:^|[,{])\\s*(?:shell|["']shell["'])\\s*:\\s*${escaped}\\b`,
    );
    if (valueReference.test(callArgs)) return true;
  }

  return staticShellNames.has('shell') && /(?:^|[,{])\s*shell\s*(?:[,}])/.test(callArgs);
}

function isNodeShellValue(value: string): boolean {
  return NODE_SHELL_BASENAMES.has(getShellTokenBasename(value));
}

function shellOptionValueBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return !source[cursor] || source[cursor] === ',' || source[cursor] === '}';
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
