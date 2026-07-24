import { getShellTokenBasename } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import {
  callEndIndex,
  escapedFunctionPattern,
  inlineScriptOption,
  isPythonCommand,
} from './interpreter-script-token.utils';
import {
  jsStaticStateBefore,
  readJsStaticStringValue,
} from './javascript-static-value.utils';
import {
  nodeChildProcessBracketCallStartIndexes,
  nodeChildProcessCallNames,
} from './node-child-process-call-name.utils';
import {
  nodeChildProcessApplyShellCommandStrings,
  nodeChildProcessApplyShellOptionCommandStrings,
} from './node-child-process-apply-shell-command.utils';
import {
  nodeChildProcessBindImmediateArgumentStartIndexes,
  nodeChildProcessReceiverBindCallArgumentStartIndexes,
} from './node-child-process-bind-wrapper.utils';
import { nodeChildProcessBindPartialShellOptionCommands } from './node-child-process-bind-shell-option.utils';
import { nodeChildProcessCallWrapperArgumentStartIndexes } from './node-child-process-call-wrapper.utils';
import { nodeChildProcessOptionalCallStartIndexes } from './node-child-process-optional-call.utils';
import { nodeCallUsesShellOption } from './node-shell-option.utils';
import { pythonShellCommandStrings } from './python-shell-command.utils';
import { rubyPerlShellCommandStrings } from './interpreter-ruby-perl-shell-command.utils';

const NODE_EXEC_FUNCTIONS = ['exec', 'execSync'];
const NODE_SHELL_OPTION_FUNCTIONS = ['spawn', 'spawnSync', 'execFile', 'execFileSync'];

export function interpreterShellCommandStrings(tokens: string[]): string[] {
  const commandTokens = shellExecutableCommandTokens(tokens);
  const name = getShellTokenBasename(commandTokens[0] ?? '');

  if (isPythonCommand(name)) return pythonShellCommandStrings(commandTokens);
  if (name === 'ruby' || name === 'perl') return rubyPerlShellCommandStrings(commandTokens, name);
  if (name === 'node') return nodeShellCommandStrings(commandTokens);
  return [];
}

function nodeShellCommandStrings(tokens: string[]): string[] {
  const code = inlineScriptOption(tokens, '-e', false);
  if (!code) return [];
  const execCallNames = nodeChildProcessCallNames(code, NODE_EXEC_FUNCTIONS);
  const shellOptionCallNames = nodeChildProcessCallNames(code, NODE_SHELL_OPTION_FUNCTIONS);

  return [
    ...nodeShellCommandCallArguments(code, execCallNames),
    ...nodeChildProcessApplyShellCommandStrings(code, execCallNames),
    ...nodeShellCommandCallArgumentsFromStarts(
      code,
      nodeChildProcessBindImmediateArgumentStartIndexes(code, execCallNames),
    ),
    ...nodeShellCommandCallArgumentsFromStarts(
      code,
      nodeChildProcessReceiverBindCallArgumentStartIndexes(code, execCallNames),
    ),
    ...nodeShellCommandCallArgumentsFromStarts(
      code,
      nodeChildProcessCallWrapperArgumentStartIndexes(code, execCallNames),
    ),
    ...nodeShellCommandCallArgumentsFromStarts(
      code,
      nodeChildProcessOptionalCallStartIndexes(code, execCallNames),
    ),
    ...nodeShellCommandCallArgumentsFromStarts(code, nodeChildProcessBracketCallStartIndexes(code, NODE_EXEC_FUNCTIONS)),
    ...nodeShellOptionLiteralCallArguments(code, shellOptionCallNames),
    ...nodeChildProcessApplyShellOptionCommandStrings(code, shellOptionCallNames),
    ...nodeChildProcessBindPartialShellOptionCommands(code, shellOptionCallNames),
    ...nodeShellOptionLiteralCallArgumentsFromStarts(
      code,
      nodeChildProcessBindImmediateArgumentStartIndexes(code, shellOptionCallNames),
    ),
    ...nodeShellOptionLiteralCallArgumentsFromStarts(
      code,
      nodeChildProcessReceiverBindCallArgumentStartIndexes(code, shellOptionCallNames),
    ),
    ...nodeShellOptionLiteralCallArgumentsFromStarts(
      code,
      nodeChildProcessCallWrapperArgumentStartIndexes(code, shellOptionCallNames),
    ),
    ...nodeShellOptionLiteralCallArgumentsFromStarts(
      code,
      nodeChildProcessOptionalCallStartIndexes(code, shellOptionCallNames),
    ),
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

function nodeShellCommandCallArgumentFromStart(code: string, callStart: number): string | null {
  return readJsStaticStringValue(code, callStart, jsStaticStateBefore(code, callStart))?.value ?? null;
}

function nodeShellOptionLiteralCallArgumentFromStart(code: string, callStart: number): string | null {
  const command = readJsStaticStringValue(code, callStart, jsStaticStateBefore(code, callStart));
  if (!command) return null;

  const callEnd = callEndIndex(code, callStart);
  return nodeCallUsesShellOption(code, callStart, callEnd) ? command.value : null;
}
