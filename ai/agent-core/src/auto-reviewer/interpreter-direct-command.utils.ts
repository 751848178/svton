import { getShellTokenBasename } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import {
  escapedFunctionPattern,
  inlineScriptOption,
  isPythonCommand,
} from './interpreter-script-token.utils';
import { readLiteralList } from './interpreter-literal-list.utils';
import type {
  InterpreterStringConcatOperator,
  InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import { nodeDirectCommandTokenGroups } from './node-direct-command.utils';
import { perlIndirectExecutableArguments } from './perl-indirect-executable.utils';
import { pythonDirectCommandTokenGroups } from './python-direct-command.utils';
import { rubyCommandArrayPairArguments } from './ruby-command-array-pair.utils';
import { skipRubyLeadingEnvHash } from './ruby-env-prefix.utils';
import {
  perlWordListDirectCommandTokenGroups,
  rubyWordListDirectCommandTokenGroups,
} from './interpreter-word-list-direct-command.utils';
import {
  readPerlQuoteLikeStringLiteral,
  readRubyQuoteLikeStringLiteral,
} from './interpreter-quote-like-string.utils';
import {
  rubyPerlStaticReferenceReader,
  rubyPerlStaticStringAssignments,
  type RubyPerlInterpreterName,
} from './ruby-perl-static-reference.utils';

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
  const operators: InterpreterStringConcatOperator[] = ['+', '<<'];
  const methodNames = ['concat', 'replace'];
  const prependMethodNames = ['prepend'];
  const literalReaders = [readRubyQuoteLikeStringLiteral];
  const assignments = rubyPerlStaticStringAssignments(
    code,
    'ruby',
    operators,
    literalReaders,
    methodNames,
    prependMethodNames,
  );
  const referenceReaders = [
    ...literalReaders,
    rubyPerlStaticReferenceReader('ruby', operators, assignments),
  ];
  return [
    ...rubyPerlDirectCommandTokenGroups(tokens),
    ...rubyWordListDirectCommandTokenGroups(code, DIRECT_RUBY_PERL_FUNCTIONS),
    ...rubyWordListDirectCommandTokenGroups(code, DIRECT_RUBY_SPAWN_FUNCTIONS),
    ...DIRECT_RUBY_SPAWN_FUNCTIONS.flatMap((functionName) =>
      literalMultiArgCallArguments(
        code,
        functionName,
        operators,
        referenceReaders,
        methodNames,
        skipRubyLeadingEnvHash,
        prependMethodNames,
      )
    ),
    ...rubyCommandArrayPairArguments(code, DIRECT_RUBY_PERL_FUNCTIONS, operators, referenceReaders),
    ...rubyCommandArrayPairArguments(code, DIRECT_RUBY_SPAWN_FUNCTIONS, operators, referenceReaders),
  ];
}

function perlDirectCommandTokenGroups(tokens: string[]): string[][] {
  const code = inlineScriptOption(tokens, '-e', true);
  const operators: InterpreterStringConcatOperator[] = ['.'];
  const literalReaders = [readPerlQuoteLikeStringLiteral];
  const assignments = rubyPerlStaticStringAssignments(code, 'perl', operators, literalReaders);
  const referenceReaders = [
    ...literalReaders,
    rubyPerlStaticReferenceReader('perl', operators, assignments, ['}']),
  ];
  return [
    ...rubyPerlDirectCommandTokenGroups(tokens),
    ...perlWordListDirectCommandTokenGroups(code, DIRECT_RUBY_PERL_FUNCTIONS),
    ...perlIndirectExecutableArguments(code, DIRECT_RUBY_PERL_FUNCTIONS, referenceReaders),
  ];
}

function rubyPerlDirectCommandTokenGroups(tokens: string[]): string[][] {
  const code = inlineScriptOption(tokens, '-e', true);
  if (!code) return [];
  const name = getShellTokenBasename(tokens[0] ?? '');
  if (!isRubyPerlInterpreter(name)) return [];
  const operators: InterpreterStringConcatOperator[] = name === 'ruby' ? ['+', '<<'] : ['.'];
  const methodNames = name === 'ruby' ? ['concat', 'replace'] : [];
  const prependMethodNames = name === 'ruby' ? ['prepend'] : [];
  const startReader = name === 'ruby' ? skipRubyLeadingEnvHash : undefined;
  const literalReaders = name === 'ruby' ? [readRubyQuoteLikeStringLiteral] : [readPerlQuoteLikeStringLiteral];
  const assignments = rubyPerlStaticStringAssignments(
    code,
    name,
    operators,
    literalReaders,
    methodNames,
    prependMethodNames,
  );
  const referenceReaders = [
    ...literalReaders,
    rubyPerlStaticReferenceReader(name, operators, assignments),
  ];

  return DIRECT_RUBY_PERL_FUNCTIONS.flatMap((functionName) =>
    literalMultiArgCallArguments(
      code,
      functionName,
      operators,
      referenceReaders,
      methodNames,
      startReader,
      prependMethodNames,
    )
  );
}

function isRubyPerlInterpreter(name: string): name is RubyPerlInterpreterName {
  return name === 'ruby' || name === 'perl';
}

type ArgumentStartReader = (source: string, startIndex: number) => number;

function literalMultiArgCallArguments(
  code: string,
  functionName: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  argumentStartReader?: ArgumentStartReader,
  prependMethodNames: string[] = [],
): string[][] {
  return callStartIndexes(code, functionName)
    .flatMap((callStart) => {
      const argumentStart = argumentStartReader?.(code, callStart) ?? callStart;
      const tokens = readLiteralList(code, argumentStart, operators, {
        literalReaders,
        methodNames,
        prependMethodNames,
      });
      return tokens && tokens.length > 1 ? [tokens] : [];
    });
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}
