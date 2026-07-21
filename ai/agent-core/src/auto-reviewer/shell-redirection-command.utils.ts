import { unquoteShellToken } from './shell-command.utils';

export function shellRedirectionCommandTokens(tokens: string[]): string[] {
  return moveLeadingInputRedirects(expandAttachedInputRedirectTokens(tokens));
}

function expandAttachedInputRedirectTokens(tokens: string[]): string[] {
  return tokens.flatMap(expandAttachedInputRedirectToken);
}

function expandAttachedInputRedirectToken(token: string): string[] {
  const word = unquoteShellToken(token);
  if (!word || word.startsWith('<(') || word.startsWith('<<') || word.startsWith('<<<')) return [token];

  const hereString = splitAtOperator(token, '<<<');
  if (hereString) return [hereString.before, hereString.operatorAndAfter].filter(Boolean);

  const hereDoc = splitAtHereDocOperator(token);
  if (hereDoc) return [hereDoc.before, hereDoc.operator, hereDoc.after].filter(Boolean);

  const input = splitAtTrailingInputRedirect(token);
  if (input) return [input.before, '<'].filter(Boolean);

  return [token];
}

function splitAtOperator(token: string, operator: string): { before: string; operatorAndAfter: string } | null {
  const index = token.indexOf(operator);
  if (index <= 0) return null;
  const before = token.slice(0, index);
  if (/^\d+$/.test(before)) return null;
  return {
    before,
    operatorAndAfter: token.slice(index),
  };
}

function splitAtHereDocOperator(token: string): { before: string; operator: string; after: string } | null {
  const match = token.match(/^(.+?)(<<-?)(.+)$/);
  if (!match || /^\d+$/.test(match[1])) return null;
  return {
    before: match[1],
    operator: match[2],
    after: match[3],
  };
}

function splitAtTrailingInputRedirect(token: string): { before: string } | null {
  if (!token.endsWith('<') || token === '<') return null;
  const before = token.slice(0, -1);
  if (/^\d+$/.test(before)) return null;
  return { before };
}

function moveLeadingInputRedirects(tokens: string[]): string[] {
  const leading: string[] = [];
  let index = 0;

  while (index < tokens.length && isStandaloneInputRedirect(tokens[index])) {
    leading.push(tokens[index]);
    const operandEnd = inputRedirectOperandEndIndex(tokens, index + 1);
    leading.push(...tokens.slice(index + 1, operandEnd));
    index = operandEnd;
  }

  if (leading.length === 0 || index >= tokens.length) return tokens;
  return [tokens[index], ...leading, ...tokens.slice(index + 1)];
}

function isStandaloneInputRedirect(token: string): boolean {
  const word = unquoteShellToken(token);
  return word === '<' || word === '<<<' || /^<<-?$/.test(word);
}

function inputRedirectOperandEndIndex(tokens: string[], startIndex: number): number {
  if (!tokens[startIndex]) return startIndex;
  if (!tokens[startIndex].startsWith('<(')) return startIndex + 1;

  for (let index = startIndex; index < tokens.length; index += 1) {
    if (tokens[index].endsWith(')')) return index + 1;
  }

  return startIndex + 1;
}
