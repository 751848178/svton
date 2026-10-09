// Secret pools are private to a job and filter data before journal persistence.
import { parseRuntimeEnv } from '../shared/runtime-env.js';

export type SecretLog = ((line: string) => void) & {
  addEnv?(content: string | undefined): void;
  addSecrets?(values: string[]): void;
};

export class SecretValues {
  private readonly values = new Set<string>();
  add(values: string[]): void {
    for (const value of values.filter(Boolean)) {
      for (const variant of [value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1), ...value.split(/\r?\n/)]) {
        if (variant) this.values.add(variant);
      }
    }
  }
  addEnv(content: string | undefined): void {
    if (content === undefined) return;
    const canonical = parseRuntimeEnv(content);
    if (canonical) { this.add(Object.values(canonical)); return; }
    // Legacy env files remain accepted. Keep both literal and decoded values
    // so diagnostics cannot reveal their quoted/escaped representations.
    const values: string[] = [];
    for (const line of content.split(/\r?\n/)) {
      const match = /^(?:export\s+)?\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const raw = match[1]!.trim();
      values.push(raw);
      if (/^['"]/.test(raw)) {
        const quote = raw[0]!;
        const end = raw.lastIndexOf(quote);
        const value = raw.slice(1, end > 0 ? end : undefined);
        values.push(value, value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
      } else values.push(raw.replace(/\s+#.*$/, '').trimEnd());
    }
    this.add(values);
  }
  redact(text: string): string {
    let result = text;
    for (const value of [...this.values].sort((a, b) => b.length - a.length)) result = result.split(value).join('***');
    return result;
  }
  redactValue<T>(value: T): T {
    if (typeof value === 'string') return this.redact(value) as T;
    if (typeof value === 'number' || typeof value === 'boolean') {
      const literal = String(value), filtered = this.redact(literal);
      return (filtered === literal ? value : filtered) as T;
    }
    if (Array.isArray(value)) return value.map((item) => this.redactValue(item)) as T;
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.redactValue(item)])) as T;
    return value;
  }
}

export function secretLog(log: SecretLog): SecretLog {
  if (log.addEnv && log.addSecrets) return log;
  const pool = new SecretValues();
  return Object.assign((line: string) => log(pool.redact(line)), {
    addEnv: (content: string | undefined) => pool.addEnv(content), addSecrets: (values: string[]) => pool.add(values),
  });
}
