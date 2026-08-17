export function getMentionContext(value: string, cursor: number) {
  let start = cursor - 1;
  while (start >= 0 && !['@', ' ', '\n'].includes(value[start])) start--;
  const active = start >= 0 && value[start] === '@'
    && (start === 0 || [' ', '\n'].includes(value[start - 1]));
  return {
    active,
    start,
    end: cursor,
    query: active ? value.slice(start + 1, cursor).toLowerCase() : '',
  };
}

export function clampComposerIndex(index: number, length: number) {
  return Math.max(0, Math.min(index, length - 1));
}

export function isOnFirstComposerLine(value: string, input: HTMLTextAreaElement) {
  return input.selectionStart === input.selectionEnd
    && value.lastIndexOf('\n', input.selectionStart - 1) === -1;
}

export function isOnLastComposerLine(value: string, input: HTMLTextAreaElement) {
  return input.selectionStart === input.selectionEnd
    && value.indexOf('\n', input.selectionEnd) === -1;
}
