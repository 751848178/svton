const XARGS_SHORT_OPTIONS_WITH_INLINE_ARGUMENT = new Set([
  '-a',
  '-d',
  '-E',
  '-I',
  '-J',
  '-L',
  '-R',
  '-S',
  '-i',
  '-l',
  '-n',
  '-P',
  '-s',
  '-e',
]);

const XARGS_SHORT_OPTIONS_WITH_SEPARATED_ARGUMENT = new Set([
  '-a',
  '-d',
  '-E',
  '-I',
  '-J',
  '-L',
  '-R',
  '-S',
  '-n',
  '-P',
  '-s',
]);

const XARGS_SHORT_FLAGS_WITHOUT_ARGUMENT = new Set([
  '0',
  'o',
  'p',
  'r',
  't',
  'x',
]);

export function xargsInlineShortOptionArgument(token: string, targetOption = ''): string {
  if (!token.startsWith('-') || token.startsWith('--')) return '';

  for (let index = 1; index < token.length; index += 1) {
    const option = `-${token[index]}`;
    if (XARGS_SHORT_OPTIONS_WITH_INLINE_ARGUMENT.has(option)) {
      const argument = token.slice(index + 1);
      return !targetOption || option === targetOption ? argument : '';
    }
    if (!XARGS_SHORT_FLAGS_WITHOUT_ARGUMENT.has(token[index])) return '';
  }

  return '';
}

export function xargsShortOptionClusterHasFlag(token: string, targetFlag: string): boolean {
  if (!token.startsWith('-') || token.startsWith('--')) return false;

  for (let index = 1; index < token.length; index += 1) {
    const option = `-${token[index]}`;
    if (token[index] === targetFlag) return true;
    if (XARGS_SHORT_OPTIONS_WITH_INLINE_ARGUMENT.has(option)) return false;
    if (!XARGS_SHORT_FLAGS_WITHOUT_ARGUMENT.has(token[index])) return false;
  }

  return false;
}

export function xargsShortOptionClusterHasOption(token: string, targetOption: string): boolean {
  if (!token.startsWith('-') || token.startsWith('--')) return false;

  for (let index = 1; index < token.length; index += 1) {
    const option = `-${token[index]}`;
    if (option === targetOption) return true;
    if (XARGS_SHORT_OPTIONS_WITH_INLINE_ARGUMENT.has(option)) return false;
    if (!XARGS_SHORT_FLAGS_WITHOUT_ARGUMENT.has(token[index])) return false;
  }

  return false;
}

export function xargsTrailingShortOptionWithSeparatedArgument(token: string): string {
  if (!token.startsWith('-') || token.startsWith('--')) return '';

  for (let index = 1; index < token.length; index += 1) {
    const option = `-${token[index]}`;
    if (XARGS_SHORT_OPTIONS_WITH_INLINE_ARGUMENT.has(option)) {
      return token.length === index + 1 && XARGS_SHORT_OPTIONS_WITH_SEPARATED_ARGUMENT.has(option)
        ? option
        : '';
    }
    if (!XARGS_SHORT_FLAGS_WITHOUT_ARGUMENT.has(token[index])) return '';
  }

  return '';
}

export function xargsShortOptionTokenIsValid(token: string): boolean {
  if (!token.startsWith('-') || token.startsWith('--')) return true;

  for (let index = 1; index < token.length; index += 1) {
    const option = `-${token[index]}`;
    if (XARGS_SHORT_OPTIONS_WITH_INLINE_ARGUMENT.has(option)) {
      return token.length > index + 1
        || XARGS_SHORT_OPTIONS_WITH_SEPARATED_ARGUMENT.has(option)
        || option === '-e'
        || option === '-i'
        || option === '-l';
    }
    if (!XARGS_SHORT_FLAGS_WITHOUT_ARGUMENT.has(token[index])) return false;
  }

  return true;
}
