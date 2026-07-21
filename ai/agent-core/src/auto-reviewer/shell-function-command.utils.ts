import { mergeWholeCommandSubstitutionTokens } from './command-substitution-token.utils';
import { splitShellWords } from './shell-command.utils';
import { splitShellCommandListSegments } from './shell-command-list.utils';
import { expandShellCommandStringPositionals } from './shell-command-string-positionals.utils';
import { type ShellPositionalArguments, shellPositionalTargetTokens } from './shell-positional-parameter.utils';
import { splitShellPipelineSegments } from './shell-pipeline-command.utils';

export type ShellFunctionDefinitions = Map<string, string>;

export function resolveShellFunctionCommand(
  statement: string,
  definitions: ShellFunctionDefinitions,
): string | null {
  const definition = readShellFunctionDefinition(statement);
  if (definition) {
    definitions.set(definition.name, definition.body);
    return null;
  }

  const tokens = splitShellFunctionWords(statement);
  const commandName = tokens[firstFunctionCommandTokenIndex(tokens)];
  return commandName && definitions.has(commandName)
    ? definitions.get(commandName) ?? statement
    : statement;
}

export function expandShellFunctionCommand(
  invocation: string,
  body: string,
  parentPositionals?: ShellPositionalArguments,
): string {
  const expandedBody = expandShellCommandStringPositionals(
    body,
    shellFunctionInvocationPositionals(invocation, parentPositionals),
  );
  return withShellFunctionInvocationPrefixAssignments(invocation, expandedBody);
}

export function expandShellFunctionPipelineCommand(
  command: string,
  definitions: ShellFunctionDefinitions,
  parentPositionals?: ShellPositionalArguments,
): string {
  const pipeSegments = splitShellPipelineSegments(command);
  let changed = false;
  const expandedSegments = pipeSegments.map((segment) => {
    const shellCommand = resolveShellFunctionCommand(segment, definitions);
    if (shellCommand === null || shellCommand === segment) return segment;
    changed = true;
    return expandShellFunctionCommand(segment, shellCommand, parentPositionals);
  });

  return changed ? expandedSegments.join(' | ') : command;
}

export function expandShellFunctionCommandList(
  command: string,
  definitions: ShellFunctionDefinitions,
): string {
  const scopedDefinitions = new Map(definitions);
  const segments = splitShellCommandListSegments(command);
  let changed = false;
  const expandedSegments = segments.map((segment) => {
    const shellCommand = resolveShellFunctionCommand(segment, scopedDefinitions);
    if (shellCommand === null) return segment;
    const expanded = expandShellFunctionPipelineCommand(segment, scopedDefinitions);
    changed ||= expanded !== segment;
    return expanded;
  });

  return changed ? expandedSegments.join('; ') : command;
}

export function normalizeShellFunctionBody(body: string): string {
  return body.trim().replace(/[;&]\s*$/, '').trim();
}

export function withShellFunctionInvocationPrefixAssignments(invocation: string, body: string): string {
  const prefixAssignments = shellFunctionInvocationPrefixAssignments(invocation);
  if (prefixAssignments.length === 0) return body;

  return `${prefixAssignments.map((assignment) => `local ${assignment}`).join('; ')}; ${body}`;
}

export function shellFunctionInvocationPositionals(
  invocation: string,
  parentPositionals?: ShellPositionalArguments,
): ShellPositionalArguments {
  const tokens = splitShellFunctionWords(invocation);
  const commandIndex = firstFunctionCommandTokenIndex(tokens);
  const args = tokens.slice(commandIndex + 1);
  return {
    argv0: parentPositionals?.argv0 ?? '',
    positionalArgs: args.flatMap((token) => shellPositionalTargetTokens(token, parentPositionals)),
  };
}

function firstFunctionCommandTokenIndex(tokens: string[]): number {
  let index = 0;
  while (index < tokens.length && isShellAssignmentPrefixToken(tokens[index])) index += 1;
  return index;
}

function shellFunctionInvocationPrefixAssignments(invocation: string): string[] {
  const assignments: string[] = [];
  for (const token of splitShellFunctionWords(invocation)) {
    if (!isShellAssignmentPrefixToken(token)) break;
    assignments.push(token);
  }
  return assignments;
}

function isShellAssignmentPrefixToken(token: string): boolean {
  const separator = token.indexOf('=');
  return separator > 0 && /^[A-Za-z_]\w*$/.test(token.slice(0, separator));
}

function splitShellFunctionWords(statement: string): string[] {
  return mergeWholeCommandSubstitutionTokens(splitShellWords(statement));
}

function readShellFunctionDefinition(statement: string): { name: string; body: string } | null {
  const compact = readFunctionDefinition(
    statement,
    /^\s*([A-Za-z_][\w-]*)\s*\(\)\s*\{\s*([\s\S]*)\s*\}\s*([\s\S]*)$/,
  );
  if (compact) return compact;

  return readFunctionDefinition(
    statement,
    /^\s*function\s+([A-Za-z_][\w-]*)(?:\s*\(\))?\s*\{\s*([\s\S]*)\s*\}\s*([\s\S]*)$/,
  );
}

function readFunctionDefinition(
  statement: string,
  pattern: RegExp,
): { name: string; body: string } | null {
  const match = statement.match(pattern);
  if (!match || !trailingRedirectionsOnly(match[3])) return null;
  return { name: match[1], body: normalizeShellFunctionBody(match[2]) };
}

function trailingRedirectionsOnly(suffix: string): boolean {
  const tokens = splitShellWords(suffix);

  for (let index = 0; index < tokens.length; index += 1) {
    const redirection = readRedirectionToken(tokens[index]);
    if (!redirection) return false;
    if (!redirection.hasOperand) index += 1;
    if (index >= tokens.length) return false;
  }

  return true;
}

function readRedirectionToken(token: string): { hasOperand: boolean } | null {
  const match = token.match(/^(?:\d+)?(?:<<-?|<<<|<>|>>?|>&|<&|&>|&>>)(.*)$/);
  return match ? { hasOperand: match[1] !== '' } : null;
}
