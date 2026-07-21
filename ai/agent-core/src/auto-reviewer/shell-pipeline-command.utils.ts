const SHELL_GROUP_CLOSERS = new Map([
  ['(', ')'],
  ['{', '}'],
]);

export function splitShellPipelineSegments(command: string): string[] {
  const segments: string[] = [];
  let segment = '';
  let quote: '"' | "'" | null = null;
  const groupClosers: string[] = [];

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      segment += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      segment += char;
      continue;
    }

    if (char === '\\') {
      segment += char;
      if (command[index + 1]) segment += command[++index];
      continue;
    }

    const groupCloser = SHELL_GROUP_CLOSERS.get(char);
    if (groupCloser) {
      groupClosers.push(groupCloser);
      segment += char;
      continue;
    }

    if (char === groupClosers[groupClosers.length - 1]) {
      groupClosers.pop();
      segment += char;
      continue;
    }

    if (
      groupClosers.length === 0
      && char === '|'
      && command[index - 1] !== '|'
      && command[index + 1] !== '|'
    ) {
      if (segment.trim()) segments.push(segment);
      segment = '';
      if (command[index + 1] === '&') index += 1;
      continue;
    }

    segment += char;
  }

  if (segment.trim()) segments.push(segment);
  return segments;
}
