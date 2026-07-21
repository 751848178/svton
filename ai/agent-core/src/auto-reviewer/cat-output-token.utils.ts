import { normalizeShellWordToken, splitShellWords, unquoteShellToken } from './shell-command.utils';

interface HereDocSpec {
  delimiter: string;
  quoted: boolean;
  stripTabs: boolean;
}

interface StdinPassthroughOptions {
  acceptExtraToken?: (token: string) => boolean;
  isComplete?: () => boolean;
}

const CAT_COMMANDS = new Set(['cat']);

export function catOutputToken(tokens: string[]): string | null {
  return stdinPassthroughOutputToken(tokens);
}

export function stdinPassthroughOutputToken(tokens: string[], options: StdinPassthroughOptions = {}): string | null {
  let hereStringToken: string | null = null;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const inlineHereString = inlineHereStringToken(token);
    if (inlineHereString !== null) {
      if (hereStringToken !== null) return null;
      hereStringToken = inlineHereString;
      continue;
    }

    if (isHereStringOperator(token)) {
      if (hereStringToken !== null || index + 1 >= tokens.length) return null;
      hereStringToken = tokens[index + 1];
      index += 1;
      continue;
    }

    if (isStdoutRedirection(token)) return null;
    if (isIgnorableCatRedirection(token) || options.acceptExtraToken?.(token)) continue;
    return null;
  }

  if (hereStringToken === null || options.isComplete?.() === false) return null;
  return normalizeShellWordToken(hereStringToken);
}

export function catHereDocOutputToken(command: string): string | null {
  return stdinPassthroughHereDocOutputToken(command, CAT_COMMANDS);
}

export function stdinPassthroughHereDocOutputToken(
  command: string,
  commandNames: Set<string>,
  options: StdinPassthroughOptions = {},
): string | null {
  const normalized = command.replace(/\r\n/g, '\n').trimStart();
  const firstNewlineIndex = normalized.indexOf('\n');
  if (firstNewlineIndex < 0) return null;

  const header = normalized.slice(0, firstNewlineIndex).trim();
  const bodyLines = normalized.slice(firstNewlineIndex + 1).split('\n');
  const spec = stdinPassthroughHereDocSpec(splitShellWords(header), commandNames, options);
  if (!spec) return null;

  const endIndex = bodyLines.findIndex((line) => hereDocLineValue(line, spec) === spec.delimiter);
  if (endIndex < 0) return null;

  const body = bodyLines
    .slice(0, endIndex)
    .map((line) => hereDocLineValue(line, spec))
    .join('\n');
  return spec.quoted ? body : normalizeUnquotedHereDocBody(body);
}

function inlineHereStringToken(token: string): string | null {
  const unquoted = unquoteShellToken(token);
  const match = unquoted.match(/^\d*<<<(.+)$/);
  return match ? token.slice(unquoted.length - match[1].length) : null;
}

function isHereStringOperator(token: string): boolean {
  return /^\d*<<<$/.test(unquoteShellToken(token));
}

function isIgnorableCatRedirection(token: string): boolean {
  const unquoted = unquoteShellToken(token);
  if (/^2>>?/.test(unquoted)) return true;
  if (unquoted === '2>&1' || unquoted === '2<&1') return true;
  return false;
}

function isStdoutRedirection(token: string): boolean {
  const unquoted = unquoteShellToken(token);
  return /^(?:1)?(?:>|>>|>\||>&)/.test(unquoted) || /^&>/.test(unquoted);
}

function stdinPassthroughHereDocSpec(
  tokens: string[],
  commandNames: Set<string>,
  options: StdinPassthroughOptions,
): HereDocSpec | null {
  const startIndex = firstPassthroughArgumentIndex(tokens, commandNames);
  if (startIndex < 0) return null;

  let spec: HereDocSpec | null = null;
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    const inlineSpec = inlineHereDocSpec(token);
    if (inlineSpec) {
      if (spec) return null;
      spec = inlineSpec;
      continue;
    }

    const operatorStripTabs = hereDocOperatorStripTabs(token);
    if (operatorStripTabs !== null) {
      if (spec || index + 1 >= tokens.length) return null;
      spec = hereDocSpecFromDelimiter(tokens[index + 1], operatorStripTabs);
      index += 1;
      continue;
    }

    if (isStdoutRedirection(token)) return null;
    if (isIgnorableCatRedirection(token) || options.acceptExtraToken?.(token)) continue;
    return null;
  }

  return spec;
}

function firstPassthroughArgumentIndex(tokens: string[], commandNames: Set<string>): number {
  const first = getTokenBasename(tokens[0] ?? '');
  if (commandNames.has(first)) return 1;
  return first === 'command' && commandNames.has(getTokenBasename(tokens[1] ?? '')) ? 2 : -1;
}

function inlineHereDocSpec(token: string): HereDocSpec | null {
  const unquoted = unquoteShellToken(token);
  const match = unquoted.match(/^\d*(<<-?)(.+)$/);
  return match ? hereDocSpecFromDelimiter(token.slice(unquoted.length - match[2].length), match[1] === '<<-') : null;
}

function hereDocOperatorStripTabs(token: string): boolean | null {
  const match = unquoteShellToken(token).match(/^\d*(<<-?)$/);
  return match ? match[1] === '<<-' : null;
}

function hereDocSpecFromDelimiter(token: string, stripTabs: boolean): HereDocSpec {
  const delimiter = normalizeShellWordToken(token);
  return { delimiter, quoted: delimiter !== token, stripTabs };
}

function normalizeUnquotedHereDocBody(body: string): string {
  return body.replace(/\\([$`\\])/g, '$1');
}

function getTokenBasename(token: string): string {
  return unquoteShellToken(token).split('/').pop() ?? '';
}

function hereDocLineValue(line: string, spec: HereDocSpec): string {
  return spec.stripTabs ? line.replace(/^\t+/, '') : line;
}
