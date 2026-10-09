const PRIVATE_KEY = /^(?:.*(?:token|password|secret|privateKey|authorization|credential).*|envFileContent|envFiles|runtimeEnv|pullAuth)$/i;

export function publicData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(publicData) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_KEY.test(key)).map(([key, item]) => [key, publicData(item)])) as T;
  }
  if (typeof value === 'string') {
    return value.replace(/(Bearer\s+)[^\s"']+/gi, '$1[redacted]')
      .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
      .replace(/((?:token|password|secret|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]') as T;
  }
  return value;
}

export function decodeJson(value: string | null | undefined): unknown { return value ? JSON.parse(value) : null; }
export const encodeJson = (value: unknown): string => JSON.stringify(publicData(value));
