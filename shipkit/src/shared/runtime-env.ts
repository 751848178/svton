const HEADER = '# shipkit-runtime-env-v1';
const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Wire encoding, not a shell/Compose .env: the Agent decodes before rendering. */
export function serializeRuntimeEnv(map: Record<string, string>): string {
  return [HEADER, ...Object.keys(map).sort().map(key => {
    const value = map[key];
    if (!KEY.test(key) || typeof value !== 'string' || /[\r\n\0]/.test(value)) throw new Error('Runtime configuration requires valid keys and single-line UTF-8 values');
    return `${key}=${JSON.stringify(value)}`;
  }), ''].join('\n');
}
export function parseRuntimeEnv(content: string): Record<string, string> | undefined {
  if (content.split(/\r?\n/, 1)[0] !== HEADER) return undefined;
  const values: Record<string, string> = Object.create(null);
  for (const line of content.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const equal = line.indexOf('='), key = line.slice(0, equal);
    if (equal < 1 || !KEY.test(key) || key in values) throw new Error('Invalid serialized runtime configuration');
    let value: unknown; try { value = JSON.parse(line.slice(equal + 1)); } catch { throw new Error('Invalid serialized runtime configuration'); }
    if (typeof value !== 'string' || /[\r\n\0]/.test(value)) throw new Error('Invalid serialized runtime configuration');
    values[key] = value;
  }
  return values;
}
