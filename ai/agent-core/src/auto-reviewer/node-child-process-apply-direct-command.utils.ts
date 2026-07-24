import { nextCommaIndex } from './interpreter-literal-list.utils';
import {
  jsStaticStateBefore,
  readJsStaticArrayValueWithBoundary,
} from './javascript-static-value.utils';
import {
  nodeChildProcessApplyArgumentArrayStartIndexes,
  readNodeApplyArrayCommandValue,
} from './node-child-process-apply-wrapper.utils';

export function nodeChildProcessApplyDirectTokenGroups(
  code: string,
  functionNames: string[],
): string[][] {
  return nodeChildProcessApplyArgumentArrayStartIndexes(code, functionNames)
    .map((arrayStart) => applyDirectTokenGroup(code, arrayStart))
    .filter((tokens) => tokens.length > 1);
}

function applyDirectTokenGroup(code: string, arrayStart: number): string[] {
  const command = readNodeApplyArrayCommandValue(code, arrayStart);
  if (!command) return [];

  const comma = nextCommaIndex(code, command.endIndex + 1);
  const state = jsStaticStateBefore(code, arrayStart);
  const args = comma >= 0
    ? readJsStaticArrayValueWithBoundary(code, comma + 1, state, nestedApplyArrayBoundary)
    : null;
  return [command.value, ...(args ?? [])];
}

function nestedApplyArrayBoundary(source: string, index: number): boolean {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ',' || source[cursor] === ']';
}
