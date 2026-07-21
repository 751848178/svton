import { stripHereDocBodies } from './shell-here-doc-command.utils';
import {
  getShellTokenBasename,
  normalizeShellWordToken,
  splitShellSegments,
  splitShellWords,
  unquoteShellToken,
} from './shell-command.utils';
import { splitShellCommandListSegments } from './shell-command-list.utils';
import { trapCommandString } from './rm-trap-command.utils';
import { shellCaseBranchCommandStrings } from './shell-case-command.utils';
import { stripShellControlCommandPrefix } from './shell-control-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';

interface ShellAliasState {
  aliases: Map<string, string>;
  enabled: boolean;
}

export function aliasExpandedShellCommand(command: string): string {
  const state: ShellAliasState = {
    aliases: new Map(),
    enabled: false,
  };
  const expandedLines: string[] = [];
  const trapActions: string[] = [];
  const expandedGroups: string[] = [];
  const expandedCaseBranches: string[] = [];
  const expandedControlCommands: string[] = [];
  let changed = false;

  for (const line of splitShellSegments(stripHereDocBodies(command), (char) => char === '\n')) {
    const statements = splitShellCommandListSegments(line);
    const expandedStatements = statements.map((statement) => {
      const expanded = expandAliasStatement(statement, state);
      changed ||= expanded !== statement;
      const trapAction = trapCommandString(splitShellWords(expanded));
      if (trapAction) trapActions.push(trapAction);
      const groupCommand = unwrapShellGroupCommand(expanded, { stripTrailingTerminator: true });
      if (groupCommand !== expanded) {
        const expandedGroup = expandAliasCommand(groupCommand, state);
        if (expandedGroup && expandedGroup !== groupCommand) expandedGroups.push(expandedGroup);
      }
      for (const branchCommand of shellCaseBranchCommandStrings(expanded)) {
        const expandedBranch = expandAliasCommand(branchCommand, state);
        if (expandedBranch && expandedBranch !== branchCommand) expandedCaseBranches.push(expandedBranch);
      }
      const controlCommand = stripShellControlCommandPrefix(expanded);
      if (controlCommand !== expanded.trimStart()) {
        const expandedControlCommand = expandAliasCommand(controlCommand, state);
        if (expandedControlCommand && expandedControlCommand !== controlCommand) {
          expandedControlCommands.push(expandedControlCommand);
        }
      }
      return expanded;
    });
    expandedLines.push(expandedStatements.join('; '));
    statements.forEach((statement) => applyAliasState(statement, state));
  }

  const expandedTrapActions = trapActions.map((action) => expandAliasCommand(action, state))
    .filter((action) => action && !trapActions.includes(action));
  if (expandedTrapActions.length > 0) {
    expandedLines.push(...expandedTrapActions);
    changed = true;
  }
  if (expandedGroups.length > 0) {
    expandedLines.push(...expandedGroups);
    changed = true;
  }
  if (expandedCaseBranches.length > 0) {
    expandedLines.push(...expandedCaseBranches);
    changed = true;
  }
  if (expandedControlCommands.length > 0) {
    expandedLines.push(...expandedControlCommands);
    changed = true;
  }

  return changed ? expandedLines.join('\n') : '';
}

function expandAliasCommand(command: string, state: ShellAliasState): string {
  return splitShellSegments(stripHereDocBodies(command), (char) => char === '\n')
    .map((line) => splitShellCommandListSegments(line)
      .map((statement) => expandAliasStatement(statement, state))
      .join('; '))
    .join('\n');
}

function expandAliasStatement(statement: string, state: ShellAliasState): string {
  if (!state.enabled) return statement;

  const functionDefinition = expandAliasFunctionDefinition(statement, state);
  if (functionDefinition !== statement) return functionDefinition;

  const [commandName, ...args] = splitShellWords(statement);
  const aliasCommand = state.aliases.get(unquoteShellToken(commandName ?? ''));
  return aliasCommand ? [aliasCommand, ...args].join(' ') : statement;
}

function expandAliasFunctionDefinition(statement: string, state: ShellAliasState): string {
  const compact = statement.match(/^(\s*[A-Za-z_][\w-]*\s*\(\)\s*\{\s*)([\s\S]*?)(\s*\}\s*)$/);
  if (compact) return expandFunctionBody(compact, state);

  const keyword = statement.match(/^(\s*function\s+[A-Za-z_][\w-]*(?:\s*\(\))?\s*\{\s*)([\s\S]*?)(\s*\}\s*)$/);
  return keyword ? expandFunctionBody(keyword, state) : statement;
}

function expandFunctionBody(match: RegExpMatchArray, state: ShellAliasState): string {
  const expandedBody = expandAliasCommand(match[2], state);
  return expandedBody === match[2] ? match[0] : `${match[1]}${expandedBody}${match[3]}`;
}

function applyAliasState(statement: string, state: ShellAliasState): void {
  const tokens = splitUnquotedIfsExpansionTokens(splitShellWords(statement));
  const command = getShellTokenBasename(tokens[0] ?? '');
  if (command === 'shopt') {
    applyShoptAliasState(tokens, state);
    return;
  }
  if (command === 'alias') applyAliasDefinitions(tokens, state);
  if (command === 'unalias') applyUnalias(tokens, state);
}

function applyShoptAliasState(tokens: string[], state: ShellAliasState): void {
  let mode: boolean | null = null;

  for (const token of tokens.slice(1).map(unquoteShellToken)) {
    if (token === '-s') mode = true;
    if (token === '-u') mode = false;
    if (token === 'expand_aliases' && mode !== null) state.enabled = mode;
  }
}

function applyAliasDefinitions(tokens: string[], state: ShellAliasState): void {
  for (const token of tokens.slice(1)) {
    const definition = aliasDefinition(token);
    if (definition) state.aliases.set(definition.name, definition.command);
  }
}

function aliasDefinition(token: string): { name: string; command: string } | null {
  const separator = token.indexOf('=');
  if (separator <= 0) return null;

  const name = unquoteShellToken(token.slice(0, separator));
  if (!/^[A-Za-z_][\w-]*$/.test(name)) return null;
  return {
    name,
    command: normalizeShellWordToken(token.slice(separator + 1)),
  };
}

function applyUnalias(tokens: string[], state: ShellAliasState): void {
  for (const token of tokens.slice(1).map(unquoteShellToken)) {
    if (token === '-a') state.aliases.clear();
    if (!token.startsWith('-')) state.aliases.delete(token);
  }
}
