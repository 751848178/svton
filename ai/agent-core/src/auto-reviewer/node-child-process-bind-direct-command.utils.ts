import {
  jsStaticStateBefore,
  readJsStaticArrayValue,
  readJsStaticStringValue,
} from './javascript-static-value.utils';
import { nodeChildProcessBindPartialCalls } from './node-child-process-bind-wrapper.utils';

export function nodeChildProcessBindPartialDirectTokenGroups(
  code: string,
  functionNames: string[],
): string[][] {
  return nodeChildProcessBindPartialCalls(code, functionNames)
    .map((call) => {
      const state = jsStaticStateBefore(code, call.boundArgumentStart);
      const command = readJsStaticStringValue(code, call.boundArgumentStart, state)?.value;
      if (!command) return [];

      const args = readJsStaticArrayValue(code, call.invocationArgumentStart, state);
      return [command, ...(args ?? [])];
    })
    .filter((tokens) => tokens.length > 1);
}
