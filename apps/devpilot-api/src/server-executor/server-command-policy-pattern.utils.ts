import { isMatch as microMatch, makeRe } from "micromatch";

const REGEX_PATTERN_PREFIX = "regex:";

const MICROMATCH_OPTIONS = {
  bash: true,
  dot: true,
  nonegate: true,
};

export function isCommandPolicyPatternMatch(
  pattern: string,
  command: string,
): boolean {
  const regexSource = readRegexPatternSource(pattern);
  if (regexSource !== undefined) {
    return compileRegex(regexSource)?.test(command) ?? false;
  }
  return microMatch(command, pattern, MICROMATCH_OPTIONS);
}

export function isValidCommandPolicyPattern(pattern: string): boolean {
  const regexSource = readRegexPatternSource(pattern);
  if (regexSource !== undefined) {
    return Boolean(compileRegex(regexSource));
  }
  try {
    return Boolean(makeRe(pattern, MICROMATCH_OPTIONS));
  } catch {
    return false;
  }
}

export function commandPolicyPatternKind(pattern: string): "glob" | "regex" {
  return readRegexPatternSource(pattern) === undefined ? "glob" : "regex";
}

function readRegexPatternSource(pattern: string): string | undefined {
  return pattern.startsWith(REGEX_PATTERN_PREFIX)
    ? pattern.slice(REGEX_PATTERN_PREFIX.length)
    : undefined;
}

function compileRegex(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern);
  } catch {
    return undefined;
  }
}
