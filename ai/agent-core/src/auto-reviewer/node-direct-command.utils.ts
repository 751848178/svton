import { escapedFunctionPattern } from './interpreter-script-token.utils';
import { nextCommaIndex } from './interpreter-literal-list.utils';
import {
  jsStaticStateBefore,
  readJsStaticArrayValue,
  readJsStaticStringExpression,
  readJsStaticStringValue,
} from './javascript-static-value.utils';
import {
  nodeChildProcessBracketCallStartIndexes,
  nodeChildProcessCallNames,
} from './node-child-process-call-name.utils';

const DIRECT_NODE_FUNCTIONS = ['execFile', 'execFileSync', 'spawn', 'spawnSync'];

export function nodeDirectCommandTokenGroups(code: string): string[][] {
  return [
    ...nodeChildProcessCallNames(code, DIRECT_NODE_FUNCTIONS)
      .flatMap((functionName) => commandAndArrayCallArguments(code, functionName)),
    ...nodeChildProcessBracketCallStartIndexes(code, DIRECT_NODE_FUNCTIONS)
      .map((callStart) => commandAndArrayCallArgumentsFromStart(code, callStart)),
  ].filter((tokens) => tokens.length > 1);
}

function commandAndArrayCallArguments(code: string, functionName: string): string[][] {
  return callStartIndexes(code, functionName)
    .map((callStart) => commandAndArrayCallArgumentsFromStart(code, callStart))
    .filter((tokens) => tokens.length > 1);
}

function commandAndArrayCallArgumentsFromStart(code: string, callStart: number): string[] {
  const state = jsStaticStateBefore(code, callStart);
  const comma = nextCommaIndex(code, callStart);
  const command = comma >= 0
    ? readJsStaticStringExpression(code.slice(callStart, comma), state)
    : readJsStaticStringValue(code, callStart, state)?.value;
  if (!command) return [];

  const args = comma >= 0 ? readJsStaticArrayValue(code, comma + 1, state) : null;
  return [command, ...(args ?? [])];
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}
