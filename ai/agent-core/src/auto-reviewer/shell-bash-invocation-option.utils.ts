export type PendingBashOptionArgument = 'skip' | 'shopt-option' | 'enable-shell-option' | 'disable-shell-option';

const BASH_OPTIONS_WITH_ARGUMENT = new Set(['-O', '+O', '-o', '+o', '--init-file', '--rcfile']);
const BASH_CLUSTERABLE_SHORT_OPTIONS = new Set('abcefhiklmnprstuvxBCDEHPl'.split(''));
const BASH_SUPPORTED_LONG_OPTIONS = new Set([
  '--debug',
  '--debugger',
  '--dump-po-strings',
  '--dump-strings',
  '--help',
  '--init-file',
  '--login',
  '--noediting',
  '--noprofile',
  '--norc',
  '--posix',
  '--pretty-print',
  '--protected',
  '--rcfile',
  '--restricted',
  '--verbose',
  '--version',
  '--wordexp',
]);

export function bashOptionArgument(word: string): PendingBashOptionArgument | null {
  if (word === '-o') return 'enable-shell-option';
  if (word === '+o') return 'disable-shell-option';
  if (word === '-O' || word === '+O') return 'shopt-option';
  if (BASH_OPTIONS_WITH_ARGUMENT.has(word)) return 'skip';
  return null;
}

export function isInvalidBashOptionArgument(option: PendingBashOptionArgument, word: string): boolean {
  return option !== 'skip' && (word.startsWith('-') || word.startsWith('+'));
}

export function isStartupSkippingShellOption(word: string): boolean {
  return word === 'noexec' || word === 'posix';
}

export function isBashCommandStringOption(word: string): boolean {
  return word === '-c'
    || (!word.startsWith('--')
      && word.startsWith('-')
      && word.slice(1).includes('c')
      && [...word.slice(1)].every((option) => BASH_CLUSTERABLE_SHORT_OPTIONS.has(option)));
}

export function isInvalidBashOptionWord(word: string): boolean {
  if (word === '-' || word === '--' || BASH_OPTIONS_WITH_ARGUMENT.has(word)) return false;
  if (word.startsWith('--')) return !BASH_SUPPORTED_LONG_OPTIONS.has(word);
  if (!word.startsWith('-')) return false;
  return [...word.slice(1)].some((option) => !BASH_CLUSTERABLE_SHORT_OPTIONS.has(option));
}

export function isInteractiveBashOption(word: string): boolean {
  return word === '-i'
    || word === '--interactive'
    || (!word.startsWith('--') && word.startsWith('-') && word.slice(1).includes('i'));
}

export function isPrivilegedBashOption(word: string): boolean {
  return word === '-p'
    || (!word.startsWith('--') && word.startsWith('-') && word.slice(1).includes('p'));
}

export function isPosixBashOption(word: string): boolean { return word === '--posix'; }

export function isNonExecutingBashOption(word: string): boolean {
  return word === '--help'
    || word === '--version'
    || word === '--dump-strings'
    || word === '--dump-po-strings'
    || word === '--pretty-print'
    || (!word.startsWith('--') && word.startsWith('-') && /[Dn]/.test(word.slice(1)));
}

export function isBashCommandStringSkippingOption(word: string): boolean {
  return isNonExecutingBashOption(word) || word === '--wordexp';
}
