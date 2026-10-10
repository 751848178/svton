import { identityFault } from './identity-error.js';

/** JSON.parse validates syntax; this second pass rejects duplicate object keys. */
export function parsePrivateIdentityJson(bytes: Uint8Array): unknown {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes), value: unknown = JSON.parse(text);
    const stack: Array<Set<string> | null> = [];
    for (let i = 0; i < text.length; i++) {
      const character = text[i];
      if (character === '{') stack.push(new Set());
      else if (character === '[') stack.push(null);
      else if (character === '}' || character === ']') stack.pop();
      else if (character === '"') {
        const start = i++;
        for (; i < text.length; i++) {
          if (text[i] === '\\') i++;
          else if (text[i] === '"') break;
        }
        let next = i + 1;
        while (/\s/.test(text[next] ?? '') && next < text.length) next++;
        if (text[next] === ':') {
          const key = JSON.parse(text.slice(start, i + 1)) as string, keys = stack.at(-1);
          if (!keys || keys.has(key)) return identityFault('REGISTRATION_FILE_INVALID');
          keys.add(key);
        }
      }
    }
    return value;
  } catch { return identityFault('REGISTRATION_FILE_INVALID'); }
}
