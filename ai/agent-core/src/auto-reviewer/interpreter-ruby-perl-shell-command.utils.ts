import {
  escapedFunctionPattern,
  inlineScriptOption,
  quotedStringEndIndex,
} from './interpreter-script-token.utils';
import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import {
  readPerlCommandOutputLiteral,
  readPerlQuoteLikeStringLiteral,
  readRubyCommandOutputLiteral,
  readRubyQuoteLikeStringLiteral,
} from './interpreter-quote-like-string.utils';
import {
  rubyPerlStaticReferenceReader,
  rubyPerlStaticStringAssignments,
  type RubyPerlInterpreterName,
  type RubyPerlStaticStringAssignment,
} from './ruby-perl-static-reference.utils';

const RUBY_PERL_SHELL_FUNCTIONS = ['system', 'exec'];

export function rubyPerlShellCommandStrings(tokens: string[], name: 'ruby' | 'perl'): string[] {
  const code = inlineScriptOption(tokens, '-e', true);
  if (!code) return [];

  const operators: InterpreterStringConcatOperator[] = name === 'ruby' ? ['+', '<<'] : ['.'];
  const methodNames = name === 'ruby' ? ['concat', 'replace'] : [];
  const prependMethodNames = name === 'ruby' ? ['prepend'] : [];
  const literalReaders = [name === 'ruby' ? readRubyQuoteLikeStringLiteral : readPerlQuoteLikeStringLiteral];
  const commandOutputReader = name === 'ruby' ? readRubyCommandOutputLiteral : readPerlCommandOutputLiteral;
  const assignments = rubyPerlStaticStringAssignments(
    code,
    name,
    operators,
    literalReaders,
    methodNames,
    prependMethodNames,
  );
  return [
    ...literalCallArguments(
      code,
      RUBY_PERL_SHELL_FUNCTIONS,
      name,
      operators,
      literalReaders,
      methodNames,
      prependMethodNames,
      assignments,
    ),
    ...commandOutputStrings(code, literalReaders, commandOutputReader),
  ];
}

function literalCallArguments(
  code: string,
  functionNames: string[],
  name: RubyPerlInterpreterName,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
  assignments: RubyPerlStaticStringAssignment[],
): string[] {
  const commands: string[] = [];
  for (const functionName of functionNames) {
    for (const match of code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))) {
      const callStart = Number(match.index) + match[0].length;
      const command = literalCallArgumentFromStart(
        code,
        callStart,
        name,
        operators,
        literalReaders,
        methodNames,
        prependMethodNames,
        assignments,
      );
      if (command) commands.push(command);
    }
  }
  return commands;
}

function literalCallArgumentFromStart(
  code: string,
  callStart: number,
  name: RubyPerlInterpreterName,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
  assignments: RubyPerlStaticStringAssignment[],
): string | null {
  return readStaticInterpreterString(code, callStart, operators, {
    methodNames,
    prependMethodNames,
    literalReaders: [
      ...literalReaders,
      rubyPerlStaticReferenceReader(name, operators, assignments),
    ],
  })?.value ?? null;
}

function commandOutputStrings(
  code: string,
  literalReaders: InterpreterStringLiteralReader[],
  commandOutputReader: InterpreterStringLiteralReader,
): string[] {
  const commands: string[] = [];
  let cursor = 0;
  while (cursor < code.length) {
    const quotedEnd = code[cursor] === '"' || code[cursor] === "'"
      ? quotedStringEndIndex(code, cursor)
      : null;
    if (quotedEnd !== null) {
      cursor = quotedEnd + 1;
      continue;
    }

    const staticLiteral = readStaticInterpreterString(code, cursor, [], { literalReaders });
    if (staticLiteral) {
      cursor = staticLiteral.endIndex + 1;
      continue;
    }

    const command = commandOutputReader(code, cursor);
    if (command) {
      commands.push(command.value);
      cursor = command.endIndex + 1;
      continue;
    }
    cursor += 1;
  }
  return commands;
}
