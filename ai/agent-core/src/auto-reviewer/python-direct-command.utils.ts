import {
  escapedFunctionPattern,
  inlineScriptOption,
} from './interpreter-script-token.utils';
import {
  pythonCallEndIndex,
  pythonKeywordValueIndex,
} from './python-call-keyword.utils';
import { pythonOsProcessCommandTokenGroups } from './python-os-process-command.utils';
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
import {
  pythonSubprocessShellArgumentValueIndex,
  pythonSubprocessShellTargets,
  type PythonSubprocessShellTarget,
} from './python-subprocess-shell-call.utils';
import {
  pythonStaticTruthyAssignments,
  readTruthyPythonValue,
  type PythonStaticTruthyAssignment,
} from './python-truthy-value.utils';

export function pythonDirectCommandTokenGroups(tokens: string[]): string[][] {
  const code = inlineScriptOption(tokens, '-c', true);
  if (!code) return [];
  const staticStringAssignments = pythonStaticStringAssignments(code);
  const staticArgvAssignments = pythonStaticArgvAssignments(code, staticStringAssignments);
  const staticTruthyAssignments = pythonStaticTruthyAssignments(code);

  return [
    ...pythonSubprocessShellTargets(code)
      .flatMap((functionName) => literalPythonArgvCallArguments(
        code,
        functionName,
        staticArgvAssignments,
        staticStringAssignments,
        staticTruthyAssignments,
      )),
    ...pythonOsProcessCommandTokenGroups(code),
  ];
}

function literalPythonArgvCallArguments(
  code: string,
  target: PythonSubprocessShellTarget,
  staticArgvAssignments: PythonStaticArgvAssignment[],
  staticStringAssignments: PythonStaticStringAssignment[],
  staticTruthyAssignments: PythonStaticTruthyAssignment[],
): string[][] {
  return callStartIndexes(code, target.name)
    .flatMap((callStart) => {
      const callEnd = pythonCallEndIndex(code, callStart);
      if (pythonSubprocessCallUsesShell(
        code,
        callStart,
        callEnd,
        target,
        staticStringAssignments,
        staticTruthyAssignments,
      )) return [];

      const executable = readPythonExecutableKeywordLiteral(code, callStart, callEnd, staticStringAssignments);
      return [
        readPythonArgvLiteral(code, callStart, staticArgvAssignments, staticStringAssignments),
        readPythonArgsKeywordLiteral(code, callStart, callEnd, staticArgvAssignments, staticStringAssignments),
      ]
        .filter((tokens): tokens is string[] => Boolean(tokens))
        .map((tokens) => pythonExecutableCommandTokens(tokens, executable));
    });
}

function pythonSubprocessCallUsesShell(
  code: string,
  callStart: number,
  callEnd: number,
  target: PythonSubprocessShellTarget,
  staticStringAssignments: PythonStaticStringAssignment[],
  staticTruthyAssignments: PythonStaticTruthyAssignment[],
): boolean {
  const shellStart = pythonSubprocessShellArgumentValueIndex(code, callStart, callEnd, target);
  return shellStart >= 0 && readTruthyPythonValue(
    code,
    shellStart,
    staticStringAssignments,
    staticTruthyAssignments,
  );
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}

function readPythonArgvLiteral(
  source: string,
  startIndex: number,
  staticArgvAssignments: PythonStaticArgvAssignment[],
  staticStringAssignments: PythonStaticStringAssignment[],
): string[] | null {
  return (
    readPythonArgvListLiteral(source, startIndex, staticStringAssignments)?.tokens ??
    readPythonStaticArgvReference(source, startIndex, staticArgvAssignments)
  );
}

function readPythonArgsKeywordLiteral(
  source: string,
  callStart: number,
  callEnd: number,
  staticArgvAssignments: PythonStaticArgvAssignment[],
  staticStringAssignments: PythonStaticStringAssignment[],
): string[] | null {
  const valueStart = pythonKeywordValueIndex(source, callStart, callEnd, 'args');
  return valueStart >= 0
    ? readPythonArgvLiteral(source, valueStart, staticArgvAssignments, staticStringAssignments)
    : null;
}

function readPythonExecutableKeywordLiteral(
  source: string,
  callStart: number,
  callEnd: number,
  staticStringAssignments: PythonStaticStringAssignment[],
): string | null {
  const valueStart = pythonKeywordValueIndex(source, callStart, callEnd, 'executable');
  const literal = valueStart >= 0 ? readPythonStringLiteral(source, valueStart) : null;
  const reference = valueStart >= 0
    ? readPythonStaticStringReference(source, valueStart, staticStringAssignments)
    : null;
  return literal?.value ?? reference?.value ?? null;
}

function pythonExecutableCommandTokens(tokens: string[], executable: string | null): string[] {
  return executable && tokens.length > 0 ? [executable, ...tokens.slice(1)] : tokens;
}
