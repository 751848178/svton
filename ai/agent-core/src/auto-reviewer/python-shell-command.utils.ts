import {
  callEndIndex,
  escapedFunctionPattern,
  inlineScriptOption,
  readQuotedLiteral,
} from './interpreter-script-token.utils';
import {
  pythonCallEndIndex,
  pythonKeywordValueIndex,
} from './python-call-keyword.utils';
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
} from './python-truthy-value.utils';

const PYTHON_SHELL_FUNCTIONS = ['os.system', 'os.popen'];

export function pythonShellCommandStrings(tokens: string[]): string[] {
  const code = inlineScriptOption(tokens, '-c', true);
  if (!code) return [];
  const staticStringAssignments = pythonStaticStringAssignments(code);
  const staticArgvAssignments = pythonStaticArgvAssignments(code, staticStringAssignments);
  const staticTruthyAssignments = pythonStaticTruthyAssignments(code);
  const subprocessTargets = pythonSubprocessShellTargets(code);

  return [
    ...pythonLiteralCallArguments(code, PYTHON_SHELL_FUNCTIONS, staticStringAssignments),
    ...pythonSubprocessShellCommandStrings(
      code,
      subprocessTargets,
      staticStringAssignments,
      staticArgvAssignments,
      staticTruthyAssignments,
    ),
  ];
}

function pythonLiteralCallArguments(
  code: string,
  functionNames: string[],
  staticStringAssignments: PythonStaticStringAssignment[],
): string[] {
  const commands: string[] = [];
  for (const functionName of functionNames) {
    for (const match of code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))) {
      const callStart = Number(match.index) + match[0].length;
      const command = pythonLiteralCallArgumentFromStart(code, callStart, staticStringAssignments);
      if (command) commands.push(command);
    }
  }
  return commands;
}

function pythonSubprocessShellCommandStrings(
  code: string,
  targets: PythonSubprocessShellTarget[],
  staticStringAssignments: PythonStaticStringAssignment[],
  staticArgvAssignments: PythonStaticArgvAssignment[],
  staticTruthyAssignments: ReturnType<typeof pythonStaticTruthyAssignments>,
): string[] {
  const commands: string[] = [];
  for (const target of targets) {
    for (const match of code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(target.name)}\\s*\\(`, 'g'))) {
      const callStart = Number(match.index) + match[0].length;
      const callEnd = pythonCallEndIndex(code, callStart);
      const shellStart = pythonSubprocessShellArgumentValueIndex(code, callStart, callEnd, target);
      if (
        shellStart < 0 ||
        !readTruthyPythonValue(code, shellStart, staticStringAssignments, staticTruthyAssignments)
      ) continue;

      const positional = pythonShellCommandValueFromStart(
        code,
        callStart,
        staticStringAssignments,
        staticArgvAssignments,
      );
      if (positional) commands.push(positional);

      const argsStart = pythonKeywordValueIndex(code, callStart, callEnd, 'args');
      if (argsStart < 0) continue;
      const keyword = pythonShellCommandValueFromStart(
        code,
        argsStart,
        staticStringAssignments,
        staticArgvAssignments,
      );
      if (keyword) commands.push(keyword);
    }
  }
  return commands;
}

function pythonShellCommandValueFromStart(
  code: string,
  valueStart: number,
  staticStringAssignments: PythonStaticStringAssignment[],
  staticArgvAssignments: PythonStaticArgvAssignment[],
): string | null {
  const scalar = pythonLiteralCallArgumentFromStart(code, valueStart, staticStringAssignments);
  if (scalar) return scalar;

  const list = readPythonArgvListLiteral(code, valueStart, staticStringAssignments)?.tokens ??
    readPythonStaticArgvReference(code, valueStart, staticArgvAssignments);
  return list?.[0] ?? null;
}

function pythonLiteralCallArgumentFromStart(
  code: string,
  callStart: number,
  staticStringAssignments: PythonStaticStringAssignment[],
): string | null {
  const command = readPythonStringLiteral(code, callStart) ??
    readPythonStaticStringReference(code, callStart, staticStringAssignments);
  if (command) return command.value;

  const literal = readQuotedLiteral(code, callStart);
  return literal && literal.endIndex < callEndIndex(code, callStart) ? literal.value : null;
}
