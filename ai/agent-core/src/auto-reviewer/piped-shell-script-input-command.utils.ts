import { literalCommandOutputToken } from './literal-command-output.utils';
import { hereDocCommandStrings, hereDocMarkerCount, stripHereDocBodies } from './shell-here-doc-command.utils';
import { getShellTokenBasename, splitShellSegments, unquoteShellToken } from './shell-command.utils';
import { shellRedirectionCommandTokens } from './shell-redirection-command.utils';
import { shellScriptInvocation } from './shell-script-invocation.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { isShellStdinPath } from './shell-stdin-path.utils';

const SHELL_SOURCE_COMMANDS = new Set(['source', '.']);

type SplitCommandTokens = (command: string) => string[];
type TokensStartWithShell = (tokens: string[]) => boolean;

function firstOperand(tokens: string[], startIndex: number): string {
  for (let index = Math.max(startIndex, 0); index < tokens.length; index += 1) {
    const word = unquoteShellToken(tokens[index]);
    if (isInputRedirectToken(word)) break;
    if (word.startsWith('-')) continue;
    return word;
  }

  return '';
}

function isInputRedirectToken(word: string): boolean {
  return word === '<'
    || word === '<<<'
    || word.startsWith('<<<')
    || /^<<-?/.test(word);
}

function shellReadsPipelineScript(tokens: string[], tokensStartWithShell: TokensStartWithShell): boolean {
  return shellScriptInvocation(tokens, tokensStartWithShell)?.readsStdin ?? false;
}

function sourceReadsPipelineScript(tokens: string[]): boolean {
  if (!SHELL_SOURCE_COMMANDS.has(getShellTokenBasename(tokens[0] ?? ''))) return false;
  return tokens.slice(1).some(isShellStdinPath);
}

function readsPipelineScript(tokens: string[], tokensStartWithShell: TokensStartWithShell): boolean {
  return shellReadsPipelineScript(tokens, tokensStartWithShell) || sourceReadsPipelineScript(tokens);
}

function catReadsStdin(tokens: string[]): boolean {
  const commandTokens = shellRedirectionCommandTokens(splitUnquotedIfsExpansionTokens(tokens));
  if (getShellTokenBasename(commandTokens[0] ?? '') !== 'cat') return false;
  const operand = firstOperand(commandTokens, 1);
  return !operand || operand === '-';
}

function producerScriptCommandString(
  segment: string,
  splitCommandTokens: SplitCommandTokens,
  hereDocs: string[],
  hereDocIndex: number,
): string {
  const literal = literalCommandOutputToken(segment);
  if (literal) return literal;
  if (hereDocMarkerCount(segment) === 0 || !catReadsStdin(splitCommandTokens(segment))) return '';
  return hereDocs[hereDocIndex] ?? '';
}

export function pipedShellScriptInputCommandStrings(
  statement: string,
  splitCommandTokens: SplitCommandTokens,
  tokensStartWithShell: TokensStartWithShell,
): string[] {
  const commandHeader = stripHereDocBodies(statement);
  const pipeSegments = splitShellSegments(commandHeader, (char) => char === '|');
  const hereDocs = hereDocCommandStrings(statement);
  const scripts: string[] = [];
  let hereDocIndex = 0;

  for (let index = 1; index < pipeSegments.length; index += 1) {
    const producerSegment = pipeSegments[index - 1];
    const receiverTokens = shellRedirectionCommandTokens(
      splitUnquotedIfsExpansionTokens(splitCommandTokens(pipeSegments[index])),
    );
    const script = readsPipelineScript(receiverTokens, tokensStartWithShell)
      ? producerScriptCommandString(producerSegment, splitCommandTokens, hereDocs, hereDocIndex)
      : '';
    if (script) scripts.push(script);
    hereDocIndex += hereDocMarkerCount(producerSegment);
  }

  return scripts;
}
