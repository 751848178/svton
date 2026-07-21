import {
  escapedFunctionPattern,
} from './interpreter-script-token.utils';
import { nextCommaIndex } from './interpreter-literal-list.utils';
import { pythonModuleCallNames } from './python-import-call-name.utils';
import {
  readPythonArgvListLiteral,
  pythonStaticArgvAssignments,
  readPythonStaticArgvReference,
  type PythonStaticArgvAssignment,
} from './python-static-argv.utils';
import {
  pythonStaticStringAssignments,
  readPythonStaticStringReference,
  type PythonStaticStringAssignment,
} from './python-static-string.utils';
import { readPythonStringLiteral } from './python-string-literal.utils';

const EXEC_LIST_FUNCTIONS = ['execv', 'execve', 'execvp', 'execvpe'];
const EXEC_MULTI_FUNCTIONS = ['execl', 'execle', 'execlp', 'execlpe'];
const SPAWN_LIST_FUNCTIONS = ['spawnv', 'spawnve', 'spawnvp', 'spawnvpe'];
const SPAWN_MULTI_FUNCTIONS = ['spawnl', 'spawnle', 'spawnlp', 'spawnlpe'];

export function pythonOsProcessCommandTokenGroups(code: string): string[][] {
  const staticStringAssignments = pythonStaticStringAssignments(code);
  const staticArgvAssignments = pythonStaticArgvAssignments(code, staticStringAssignments);
  return [
    ...pythonOsProcessCallNames(code, EXEC_LIST_FUNCTIONS)
      .map((functionName) => literalCommandAndArgvCallArguments(
        code,
        functionName,
        0,
        staticStringAssignments,
        staticArgvAssignments,
      )),
    ...pythonOsProcessCallNames(code, EXEC_MULTI_FUNCTIONS)
      .map((functionName) => literalCommandAndMultiArgCallArguments(code, functionName, 0, staticStringAssignments)),
    ...pythonOsProcessCallNames(code, SPAWN_LIST_FUNCTIONS)
      .map((functionName) => literalCommandAndArgvCallArguments(
        code,
        functionName,
        1,
        staticStringAssignments,
        staticArgvAssignments,
      )),
    ...pythonOsProcessCallNames(code, SPAWN_MULTI_FUNCTIONS)
      .map((functionName) => literalCommandAndMultiArgCallArguments(code, functionName, 1, staticStringAssignments)),
  ].flat().filter((tokens) => tokens.length > 1);
}

function pythonOsProcessCallNames(code: string, functionNames: string[]): string[] {
  return pythonModuleCallNames(code, 'os', functionNames);
}

function literalCommandAndArgvCallArguments(
  code: string,
  functionName: string,
  skippedArgs: number,
  staticStringAssignments: PythonStaticStringAssignment[],
  staticArgvAssignments: PythonStaticArgvAssignment[],
): string[][] {
  return callStartIndexes(code, functionName)
    .map((callStart) => {
      const command = readCommandCallArgument(code, callStart, skippedArgs, staticStringAssignments);
      if (!command) return [];

      const argvStart = nextCommaIndex(code, command.endIndex + 1) + 1;
      const argv = (
        readPythonArgvListLiteral(code, argvStart, staticStringAssignments)?.tokens ??
        readPythonStaticArgvReference(code, argvStart, staticArgvAssignments) ??
        []
      );
      return argv.length > 1 ? [command.value, ...argv.slice(1)] : [];
    });
}

function literalCommandAndMultiArgCallArguments(
  code: string,
  functionName: string,
  skippedArgs: number,
  staticStringAssignments: PythonStaticStringAssignment[],
): string[][] {
  return callStartIndexes(code, functionName)
    .map((callStart) => {
      const command = readCommandCallArgument(code, callStart, skippedArgs, staticStringAssignments);
      if (!command) return [];

      const args = readStaticStringCallArguments(
        code,
        nextCommaIndex(code, command.endIndex + 1) + 1,
        staticStringAssignments,
      );
      return args.length > 1 ? [command.value, ...args.slice(1)] : [];
    });
}

function readCommandCallArgument(
  code: string,
  callStart: number,
  skippedArgs: number,
  staticStringAssignments: PythonStaticStringAssignment[],
): { value: string; endIndex: number } | null {
  let cursor = callStart;
  for (let count = 0; count < skippedArgs; count += 1) {
    const comma = nextCommaIndex(code, cursor);
    if (comma < 0) return null;
    cursor = comma + 1;
  }
  return readPythonStringLiteral(code, cursor) ?? readPythonStaticStringReference(code, cursor, staticStringAssignments);
}

function readStaticStringCallArguments(
  code: string,
  startIndex: number,
  staticStringAssignments: PythonStaticStringAssignment[],
): string[] {
  const values: string[] = [];
  let cursor = startIndex;

  while (cursor < code.length) {
    const argument = readPythonStringLiteral(code, cursor) ??
      readPythonStaticStringReference(code, cursor, staticStringAssignments);
    if (!argument) break;
    values.push(argument.value);
    const comma = nextCommaIndex(code, argument.endIndex + 1);
    if (comma < 0) break;
    cursor = comma + 1;
  }

  return values;
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}
