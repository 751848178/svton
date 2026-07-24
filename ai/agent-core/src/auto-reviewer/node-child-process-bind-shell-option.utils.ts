import { callEndIndex } from './interpreter-script-token.utils';
import {
  jsStaticStateBefore,
  readJsStaticStringValue,
} from './javascript-static-value.utils';
import { nodeChildProcessBindPartialCalls } from './node-child-process-bind-wrapper.utils';
import { nodeCallUsesShellOption } from './node-shell-option.utils';

export function nodeChildProcessBindPartialShellOptionCommands(
  code: string,
  functionNames: string[],
): string[] {
  return nodeChildProcessBindPartialCalls(code, functionNames)
    .filter((call) => nodeCallUsesShellOption(code, call.invocationArgumentStart, callEndIndex(code, call.invocationArgumentStart)))
    .map((call) => {
      const state = jsStaticStateBefore(code, call.boundArgumentStart);
      return readJsStaticStringValue(code, call.boundArgumentStart, state)?.value ?? null;
    })
    .filter((command): command is string => Boolean(command));
}
