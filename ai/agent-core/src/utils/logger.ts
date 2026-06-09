/**
 * Lightweight logger for Agent runtime.
 * Enable via `localStorage.setItem('agent:debug', 'true')` or `AGENT_DEBUG=true` env var.
 * All logs prefixed with [Agent] for easy filtering in console.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let _enabled: boolean | null = null;

function isEnabled(): boolean {
  if (_enabled !== null) return _enabled;
  // Check browser localStorage FIRST — in bundled browser code,
  // process.env shim may exist but never has AGENT_DEBUG set,
  // which would short-circuit and skip the localStorage check.
  if (typeof window !== 'undefined') {
    try {
      _enabled = localStorage.getItem('agent:debug') === 'true';
      return _enabled;
    } catch {
      // localStorage not available (SSR, sandboxed iframe, etc.)
    }
  }
  if (typeof process !== 'undefined' && process.env?.AGENT_DEBUG === 'true') {
    _enabled = true;
    return true;
  }
  _enabled = false;
  return false;
}

const CSS = {
  debug: 'color: #999',
  info: 'color: #3b82f6',
  warn: 'color: #f59e0b',
  error: 'color: #ef4444',
};

function formatTag(tag: string): string {
  return `%c[Agent:${tag}]`;
}

export const logger = {
  debug(tag: string, ...args: unknown[]) {
    if (!isEnabled()) return;
    console.debug(formatTag(tag), CSS.debug, ...args);
  },
  info(tag: string, ...args: unknown[]) {
    if (!isEnabled()) return;
    console.info(formatTag(tag), CSS.info, ...args);
  },
  warn(tag: string, ...args: unknown[]) {
    console.warn(formatTag(tag), CSS.warn, ...args);
  },
  error(tag: string, ...args: unknown[]) {
    console.error(formatTag(tag), CSS.error, ...args);
  },

  /** Create a child logger with a fixed tag prefix */
  child(tag: string) {
    return {
      debug: (...args: unknown[]) => logger.debug(tag, ...args),
      info: (...args: unknown[]) => logger.info(tag, ...args),
      warn: (...args: unknown[]) => logger.warn(tag, ...args),
      error: (...args: unknown[]) => logger.error(tag, ...args),
    };
  },
};
