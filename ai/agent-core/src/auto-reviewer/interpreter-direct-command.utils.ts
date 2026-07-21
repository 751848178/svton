import { getShellTokenBasename } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import {
  escapedFunctionPattern,
  inlineScriptOption,
  isPythonCommand,
} from './interpreter-script-token.utils';
import { readLiteralList } from './interpreter-literal-list.utils';
import { nodeDirectCommandTokenGroups } from './node-direct-command.utils';
import { perlIndirectExecutableArguments } from './perl-indirect-executable.utils';
import { pythonDirectCommandTokenGroups } from './python-direct-command.utils';
import { rubyCommandArrayPairArguments } from './ruby-command-array-pair.utils';

const DIRECT_RUBY_PERL_FUNCTIONS = ['system', 'exec'];
const DIRECT_RUBY_SPAWN_FUNCTIONS = ['spawn', 'Process.spawn'];

export function interpreterDirectCommandTokenGroups(tokens: string[]): string[][] {
  const commandTokens = shellExecutableCommandTokens(tokens);
  const name = getShellTokenBasename(commandTokens[0] ?? '');

  if (isPythonCommand(name)) return pythonDirectCommandTokenGroups(commandTokens);
  if (name === 'ruby') return rubyDirectCommandTokenGroups(commandTokens);
  if (name === 'perl') return perlDirectCommandTokenGroups(commandTokens);
  if (name === 'node') return nodeDirectCommandTokenGroups(inlineScriptOption(commandTokens, '-e', false));
  return [];
}

function rubyDirectCommandTokenGroups(tokens: string[]): string[][] {
  const code = inlineScriptOption(tokens, '-e', true) ?? '';
  return [
    ...rubyPerlDirectCommandTokenGroups(tokens),
    ...DIRECT_RUBY_SPAWN_FUNCTIONS.flatMap((functionName) => literalMultiArgCallArguments(code, functionName)),
    ...rubyCommandArrayPairArguments(code, DIRECT_RUBY_PERL_FUNCTIONS),
  ];
}

function perlDirectCommandTokenGroups(tokens: string[]): string[][] {
  const code = inlineScriptOption(tokens, '-e', true);
  return [
    ...rubyPerlDirectCommandTokenGroups(tokens),
    ...perlIndirectExecutableArguments(code, DIRECT_RUBY_PERL_FUNCTIONS),
  ];
}

function rubyPerlDirectCommandTokenGroups(tokens: string[]): string[][] {
  const code = inlineScriptOption(tokens, '-e', true);
  if (!code) return [];

  return DIRECT_RUBY_PERL_FUNCTIONS.flatMap((functionName) => literalMultiArgCallArguments(code, functionName));
}

function literalMultiArgCallArguments(code: string, functionName: string): string[][] {
  return callStartIndexes(code, functionName)
    .flatMap((callStart) => {
      const tokens = readLiteralList(code, callStart);
      return tokens && tokens.length > 1 ? [tokens] : [];
    });
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}
