import { getShellTokenBasename } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import {
  callEndIndex,
  escapedFunctionPattern,
  inlineScriptOption,
  isPythonCommand,
  readQuotedLiteral,
} from './interpreter-script-token.utils';
import {
  jsStaticStateBefore,
  readJsStaticStringValue,
} from './javascript-static-value.utils';
import {
  nodeChildProcessBracketCallStartIndexes,
  nodeChildProcessCallNames,
} from './node-child-process-call-name.utils';
import { nodeCallUsesShellOption } from './node-shell-option.utils';
import { pythonShellCommandStrings } from './python-shell-command.utils';

const RUBY_PERL_SHELL_FUNCTIONS = ['system', 'exec'];
const NODE_EXEC_FUNCTIONS = ['exec', 'execSync'];
const NODE_SHELL_OPTION_FUNCTIONS = ['spawn', 'spawnSync', 'execFile', 'execFileSync'];

export function interpreterShellCommandStrings(tokens: string[]): string[] {
  const commandTokens = shellExecutableCommandTokens(tokens);
  const name = getShellTokenBasename(commandTokens[0] ?? '');

  if (isPythonCommand(name)) return pythonShellCommandStrings(commandTokens);
  if (name === 'ruby' || name === 'perl') return rubyPerlShellCommandStrings(commandTokens);
  if (name === 'node') return nodeShellCommandStrings(commandTokens);
  return [];
}

function rubyPerlShellCommandStrings(tokens: string[]): string[] {
  const code = inlineScriptOption(tokens, '-e', true);
  return code ? literalCallArguments(code, RUBY_PERL_SHELL_FUNCTIONS) : [];
}

function nodeShellCommandStrings(tokens: string[]): string[] {
  const code = inlineScriptOption(tokens, '-e', false);
  if (!code) return [];

  return [
    ...nodeShellCommandCallArguments(code, nodeChildProcessCallNames(code, NODE_EXEC_FUNCTIONS)),
    ...nodeShellCommandCallArgumentsFromStarts(code, nodeChildProcessBracketCallStartIndexes(code, NODE_EXEC_FUNCTIONS)),
    ...nodeShellOptionLiteralCallArguments(code, nodeChildProcessCallNames(code, NODE_SHELL_OPTION_FUNCTIONS)),
    ...nodeShellOptionLiteralCallArgumentsFromStarts(
      code,
      nodeChildProcessBracketCallStartIndexes(code, NODE_SHELL_OPTION_FUNCTIONS),
    ),
  ];
}

function nodeShellCommandCallArguments(code: string, functionNames: string[]): string[] {
  const commands: string[] = [];
  for (const functionName of functionNames) {
    for (const match of code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))) {
      const callStart = Number(match.index) + match[0].length;
      const command = nodeShellCommandCallArgumentFromStart(code, callStart);
      if (command) commands.push(command);
    }
  }
  return commands;
}

function nodeShellCommandCallArgumentsFromStarts(code: string, callStarts: number[]): string[] {
  return callStarts
    .map((callStart) => nodeShellCommandCallArgumentFromStart(code, callStart))
    .filter((command): command is string => Boolean(command));
}

function literalCallArguments(code: string, functionNames: string[], requiredPattern?: RegExp): string[] {
  const commands: string[] = [];
  for (const functionName of functionNames) {
    for (const match of code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))) {
      const callStart = Number(match.index) + match[0].length;
      const command = literalCallArgumentFromStart(code, callStart, requiredPattern);
      if (command) commands.push(command);
    }
  }
  return commands;
}

function literalCallArgumentsFromStarts(code: string, callStarts: number[], requiredPattern?: RegExp): string[] {
  return callStarts
    .map((callStart) => literalCallArgumentFromStart(code, callStart, requiredPattern))
    .filter((command): command is string => Boolean(command));
}

function nodeShellOptionLiteralCallArguments(code: string, functionNames: string[]): string[] {
  const commands: string[] = [];
  for (const functionName of functionNames) {
    for (const match of code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))) {
      const callStart = Number(match.index) + match[0].length;
      const command = nodeShellOptionLiteralCallArgumentFromStart(code, callStart);
      if (command) commands.push(command);
    }
  }
  return commands;
}

function nodeShellOptionLiteralCallArgumentsFromStarts(code: string, callStarts: number[]): string[] {
  return callStarts
    .map((callStart) => nodeShellOptionLiteralCallArgumentFromStart(code, callStart))
    .filter((command): command is string => Boolean(command));
}

function literalCallArgumentFromStart(code: string, callStart: number, requiredPattern?: RegExp): string | null {
  const literal = readQuotedLiteral(code, callStart);
  if (!literal) return null;

  return !requiredPattern || requiredPattern.test(code.slice(callStart, callEndIndex(code, callStart)))
    ? literal.value
    : null;
}

function nodeShellCommandCallArgumentFromStart(code: string, callStart: number): string | null {
  return readJsStaticStringValue(code, callStart, jsStaticStateBefore(code, callStart))?.value ?? null;
}

function nodeShellOptionLiteralCallArgumentFromStart(code: string, callStart: number): string | null {
  const command = readJsStaticStringValue(code, callStart, jsStaticStateBefore(code, callStart));
  if (!command) return null;

  const callEnd = callEndIndex(code, callStart);
  return nodeCallUsesShellOption(code, callStart, callEnd) ? command.value : null;
}
