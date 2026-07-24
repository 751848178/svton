import { callEndIndex } from './interpreter-script-token.utils';
import {
  nodeChildProcessApplyArgumentArrayStartIndexes,
  readNodeApplyArrayCommandString,
} from './node-child-process-apply-wrapper.utils';
import { nodeCallUsesShellOption } from './node-shell-option.utils';

export function nodeChildProcessApplyShellCommandStrings(code: string, functionNames: string[]): string[] {
  return nodeChildProcessApplyArgumentArrayStartIndexes(code, functionNames)
    .map((arrayStart) => readNodeApplyArrayCommandString(code, arrayStart))
    .filter((command): command is string => Boolean(command));
}

export function nodeChildProcessApplyShellOptionCommandStrings(code: string, functionNames: string[]): string[] {
  return nodeChildProcessApplyArgumentArrayStartIndexes(code, functionNames)
    .filter((arrayStart) => nodeCallUsesShellOption(code, arrayStart, callEndIndex(code, arrayStart)))
    .map((arrayStart) => readNodeApplyArrayCommandString(code, arrayStart))
    .filter((command): command is string => Boolean(command));
}
