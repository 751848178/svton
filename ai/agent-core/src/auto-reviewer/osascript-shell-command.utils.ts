import { getShellTokenBasename, normalizeShellWordToken } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';

const OSASCRIPT_FORMAT_OPTIONS = new Set(['-s']);
const OSASCRIPT_LANGUAGE_OPTIONS = new Set(['-l']);

export function osascriptShellCommandStrings(tokens: string[]): string[] {
  const commandTokens = shellExecutableCommandTokens(tokens);
  if (getShellTokenBasename(commandTokens[0] ?? '') !== 'osascript') return [];

  const fragments = osascriptScriptFragments(commandTokens);
  return fragments ? applescriptShellCommandStrings(fragments.join('\n')) : [];
}

function osascriptScriptFragments(tokens: string[]): string[] | null {
  const fragments: string[] = [];
  let language = 'AppleScript';

  for (let index = 1; index < tokens.length; index += 1) {
    const token = normalizeShellWordToken(tokens[index]);
    if (token === '-i') return null;
    if (token === '-e') {
      const script = tokens[index + 1];
      if (!script) return null;
      fragments.push(normalizeShellWordToken(script));
      index += 1;
      continue;
    }
    if (token.startsWith('-e') && token.length > 2) {
      fragments.push(token.slice(2));
      continue;
    }
    if (languageOptionConsumesNext(token)) {
      const value = tokens[index + 1];
      if (!value) return null;
      language = normalizeShellWordToken(value);
      index += 1;
      continue;
    }
    if (token.startsWith('-l') && token.length > 2) {
      language = token.slice(2);
      continue;
    }
    if (formatOptionConsumesNext(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith('-s') && token.length > 2) continue;
    if (token.startsWith('-')) return null;
    break;
  }

  return language.toLowerCase() === 'applescript' && fragments.length > 0 ? fragments : null;
}

function applescriptShellCommandStrings(script: string): string[] {
  const assignments = new Map<string, string>();
  const commands: string[] = [];

  for (const statement of splitAppleScriptStatements(script)) {
    const assignment = staticStringAssignment(statement);
    if (assignment) {
      assignments.set(assignment.name, assignment.value);
      continue;
    }

    const command = doShellScriptCommand(statement, assignments);
    if (command) commands.push(command);
  }

  return commands;
}

function splitAppleScriptStatements(script: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;

  for (let index = 0; index < script.length; index += 1) {
    const char = script[index];
    if (char === '"' && script[index - 1] !== '\\') inString = !inString;
    if (!inString && (char === '\n' || char === ';')) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function staticStringAssignment(statement: string): { name: string; value: string } | null {
  const match = /^set\s+([A-Za-z_][A-Za-z0-9_]*)\s+to\s+/i.exec(statement);
  if (!match) return null;

  const literal = readAppleScriptStringLiteral(statement, match[0].length);
  return literal ? { name: match[1], value: literal.value } : null;
}

function doShellScriptCommand(statement: string, assignments: Map<string, string>): string {
  const prefix = /^do\s+shell\s+script\s+/i.exec(statement);
  if (!prefix) return '';

  const literal = readAppleScriptStringLiteral(statement, prefix[0].length);
  if (literal) return literal.value;

  const variable = /^[A-Za-z_][A-Za-z0-9_]*/.exec(statement.slice(prefix[0].length).trim());
  return variable ? assignments.get(variable[0]) ?? '' : '';
}

function readAppleScriptStringLiteral(source: string, startIndex: number): { value: string } | null {
  if (source[startIndex] !== '"') return null;
  let value = '';

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' && source[index - 1] !== '\\') return { value };
    if (char === '\\' && source[index + 1]) {
      value += source[index + 1];
      index += 1;
      continue;
    }
    value += char;
  }

  return null;
}

function languageOptionConsumesNext(token: string): boolean {
  return OSASCRIPT_LANGUAGE_OPTIONS.has(token);
}

function formatOptionConsumesNext(token: string): boolean {
  return OSASCRIPT_FORMAT_OPTIONS.has(token);
}
