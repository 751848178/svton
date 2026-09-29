// Structured logger: human text by default, one-JSON-object-per-line under --json.
// Emits to stderr by default so stdout stays reserved for machine-readable payloads.

export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export function createLogger(json: boolean, write: (line: string) => void = console.error): Logger {
  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    const ts = new Date().toISOString();
    if (json) {
      write(JSON.stringify({ ts, level, msg, ...meta }));
    } else {
      const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      write(`${ts} ${level.toUpperCase().padEnd(5)} ${msg}${extra}`);
    }
  };
  return {
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
  };
}
