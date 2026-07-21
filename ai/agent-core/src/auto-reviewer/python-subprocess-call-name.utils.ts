import { pythonModuleCallNames } from './python-import-call-name.utils';

export function pythonSubprocessCallNames(code: string, functionNames: string[]): string[] {
  return pythonModuleCallNames(code, 'subprocess', functionNames);
}
