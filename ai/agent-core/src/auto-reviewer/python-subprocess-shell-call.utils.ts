import {
  pythonKeywordValueIndex,
  pythonPositionalArgumentValueIndex,
} from './python-call-keyword.utils';
import { pythonSubprocessCallNames } from './python-subprocess-call-name.utils';

const PYTHON_SUBPROCESS_FUNCTIONS = [
  'call',
  'check_call',
  'check_output',
  'Popen',
  'run',
];
const PYTHON_POSITIONAL_SHELL_ARGUMENT_INDEX = 8;

export type PythonSubprocessShellTarget = {
  name: string;
  positionalShell: boolean;
};

export function pythonSubprocessShellTargets(code: string): PythonSubprocessShellTarget[] {
  return PYTHON_SUBPROCESS_FUNCTIONS.flatMap((functionName) =>
    pythonSubprocessCallNames(code, [functionName]).map((name) => ({
      name,
      positionalShell: functionName !== 'check_output',
    })),
  );
}

export function pythonSubprocessShellArgumentValueIndex(
  code: string,
  callStart: number,
  callEnd: number,
  target: PythonSubprocessShellTarget,
): number {
  const keywordValue = pythonKeywordValueIndex(code, callStart, callEnd, 'shell');
  if (keywordValue >= 0 || !target.positionalShell) return keywordValue;
  return pythonPositionalArgumentValueIndex(
    code,
    callStart,
    callEnd,
    PYTHON_POSITIONAL_SHELL_ARGUMENT_INDEX,
  );
}
