export interface EvaluateResultFormat {
  output: string;
  resultType: string;
  isError?: true;
  unserializableValue?: string;
}

export interface GetContentResultFormat {
  output: string;
  isError?: true;
  metadata: Record<string, unknown>;
}

export function formatRuntimeExceptionText(exceptionDetails: unknown): string {
  if (!exceptionDetails || typeof exceptionDetails !== 'object') {
    return 'Unknown error';
  }
  const text = (exceptionDetails as { text?: unknown }).text;
  return typeof text === 'string' && text.trim().length > 0 ? text : 'Unknown error';
}

export function formatEvaluateResult(result: any): EvaluateResultFormat {
  if (!result || typeof result !== 'object') {
    return {
      output: 'Chrome evaluate returned invalid evaluate result.',
      resultType: 'unknown',
      isError: true,
    };
  }
  const resultType = typeof result?.type === 'string' ? result.type : typeof result?.value;
  if (typeof result?.unserializableValue === 'string') {
    return {
      output: result.unserializableValue,
      resultType,
      unserializableValue: result.unserializableValue,
    };
  }

  if (result?.type === 'undefined' && result?.value === undefined) {
    return { output: 'undefined', resultType };
  }
  if (!hasOwnValue(result)) {
    return {
      output: 'Chrome evaluate returned invalid evaluate result.',
      resultType,
      isError: true,
    };
  }

  const value = result?.value;
  if (typeof value === 'string') {
    return { output: value, resultType };
  }
  const output = stringifyEvaluateValue(value ?? null);
  if (output === undefined) {
    return {
      output: 'Chrome evaluate returned invalid evaluate result.',
      resultType,
      isError: true,
    };
  }
  return {
    output,
    resultType,
  };
}

function hasOwnValue(result: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(result, 'value');
}

function stringifyEvaluateValue(value: unknown): string | undefined {
  try {
    const output = JSON.stringify(value, null, 2);
    return typeof output === 'string' ? output : undefined;
  } catch {
    return undefined;
  }
}

export function buildGetContentExpression(selector: string): string {
  const selectorLiteral = JSON.stringify(selector);
  return `(() => { const element = document.querySelector(${selectorLiteral}); return element ? { found: true, text: element.innerText ?? "" } : { found: false, text: "" }; })()`;
}

export function formatGetContentResult(contentResult: unknown, selector: string): GetContentResultFormat {
  if (!isGetContentBridgeResult(contentResult)) {
    return {
      output: 'Chrome get content returned invalid content result.',
      isError: true,
      metadata: { selector },
    };
  }

  if (!contentResult.found) {
    return {
      output: `Element not found: ${selector}`,
      isError: true,
      metadata: { selector, found: false },
    };
  }

  if (typeof contentResult.text !== 'string') {
    return {
      output: 'Chrome get content returned invalid text result.',
      isError: true,
      metadata: { selector, found: true },
    };
  }

  const originalLength = contentResult.text.length;
  const truncated = originalLength > 10000;
  const output = contentResult.text.substring(0, 10000) + (truncated ? '\n... (truncated)' : '');
  return {
    output,
    metadata: {
      selector,
      found: true,
      truncated,
      originalLength,
      outputLength: output.length,
    },
  };
}

function isGetContentBridgeResult(value: unknown): value is { found: boolean; text?: unknown } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return typeof (value as { found?: unknown }).found === 'boolean';
}
