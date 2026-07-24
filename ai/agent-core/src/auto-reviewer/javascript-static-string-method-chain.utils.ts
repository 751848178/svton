import { readJsConcatMethodChain } from './javascript-static-concat-method.utils';
import { readJsSliceMethodChain } from './javascript-static-slice-method.utils';
import { readJsTrimMethodChain } from './javascript-static-trim-method.utils';
import type { JsStaticValue } from './javascript-static-string.utils';

type JsStaticStringReader = (
  source: string,
  startIndex: number,
  valueForName: (name: string) => string | undefined,
  boundary: (source: string, index: number) => boolean,
) => JsStaticValue | null;

export function readJsStaticStringMethodChain(
  source: string,
  startValue: JsStaticValue,
  valueForName: (name: string) => string | undefined,
  readExpression: JsStaticStringReader,
  argumentBoundary: (source: string, index: number) => boolean,
): JsStaticValue | null {
  let result = startValue;

  while (true) {
    const startEndIndex = result.endIndex;
    const sliced = readJsSliceMethodChain(source, result);
    if (!sliced) return null;
    const trimmed = readJsTrimMethodChain(source, sliced);
    if (!trimmed) return null;
    const concatenated = readJsConcatMethodChain(
      source,
      trimmed,
      valueForName,
      readExpression,
      argumentBoundary,
    );
    if (!concatenated) return null;

    if (concatenated.endIndex === startEndIndex) {
      return concatenated;
    }
    result = concatenated;
  }
}
