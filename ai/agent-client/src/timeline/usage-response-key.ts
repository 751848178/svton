const MAX_IDENTITY_CHARS = 16_384;
const MAX_IDENTITY_FIELDS = 512;
const MAX_IDENTITY_DEPTH = 8;

interface HashState {
  first: number;
  second: number;
  chars: number;
  fields: number;
  seen: WeakSet<object>;
}

/** Hashes a bounded, cycle-safe source identity without persisting raw provider data. */
export function createUsageResponseKey(
  responseId: unknown,
  timestamp: number,
  fallbackSource: unknown,
): string {
  const state: HashState = {
    first: 2166136261,
    second: 5381,
    chars: MAX_IDENTITY_CHARS,
    fields: MAX_IDENTITY_FIELDS,
    seen: new WeakSet(),
  };
  if (typeof responseId === 'string' && responseId.length > 0) {
    feedString(state, 'response');
    feedString(state, responseId);
  } else {
    feedString(state, 'fallback');
    feedString(state, String(timestamp));
    feedValue(state, fallbackSource, 0);
  }
  return `usage:${(state.first >>> 0).toString(36)}:${(state.second >>> 0).toString(36)}`;
}

function feedValue(state: HashState, value: unknown, depth: number): void {
  if (state.fields <= 0 || state.chars <= 0) return feedString(state, ':budget');
  state.fields -= 1;
  if (value === null || typeof value !== 'object') {
    feedString(state, `${typeof value}:`);
    feedString(state, String(value));
    return;
  }
  if (state.seen.has(value)) return feedString(state, ':cycle');
  if (depth >= MAX_IDENTITY_DEPTH) return feedString(state, ':depth');
  state.seen.add(value);
  if (Array.isArray(value)) {
    feedString(state, `array:${value.length}:`);
    const indexes = boundedIndexes(value.length, state.fields);
    indexes.forEach((index) => {
      feedString(state, `${index}:`);
      feedValue(state, value[index], depth + 1);
    });
  } else {
    const keys: string[] = [];
    for (const key in value as Record<string, unknown>) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      keys.push(key);
      if (keys.length >= Math.min(state.fields, MAX_IDENTITY_FIELDS)) break;
    }
    keys.sort();
    feedString(state, `object:${keys.length}:`);
    keys.forEach((key) => {
      feedString(state, key);
      feedValue(state, (value as Record<string, unknown>)[key], depth + 1);
    });
  }
  state.seen.delete(value);
}

function boundedIndexes(length: number, budget: number): number[] {
  const count = Math.min(length, budget, MAX_IDENTITY_FIELDS);
  if (count >= length) return Array.from({ length }, (_, index) => index);
  const tailCount = Math.min(16, count);
  const headCount = count - tailCount;
  return [
    ...Array.from({ length: headCount }, (_, index) => index),
    ...Array.from({ length: tailCount }, (_, index) => length - tailCount + index),
  ];
}

function feedString(state: HashState, value: string): void {
  if (state.chars <= 0) return;
  const marker = `#${value.length}:`;
  hashChunk(state, marker.slice(0, state.chars));
  const available = state.chars;
  if (available <= 0) return;
  const headLength = Math.min(value.length, available <= 64 ? available : available - 32);
  const tailLength = Math.min(value.length - headLength, available - headLength);
  const sample = tailLength > 0
    ? `${value.slice(0, headLength)}${value.slice(value.length - tailLength)}`
    : value.slice(0, headLength);
  hashChunk(state, sample);
}

function hashChunk(state: HashState, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    state.first = Math.imul(state.first ^ code, 16777619);
    state.second = Math.imul(state.second, 33) ^ code;
  }
  state.chars -= value.length;
}
