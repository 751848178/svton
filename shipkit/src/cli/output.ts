// Output emitter: progress logs go to stderr; machine-readable payload goes to stdout under --json.

import { createLogger, type Logger } from '../shared/log.js';

export interface Emitter {
  json: boolean;
  log: Logger;
  /** print the command's result payload (JSON only; text commands print their own summaries) */
  payload(data: unknown): void;
}

export function createEmitter(json: boolean): Emitter {
  return {
    json,
    log: createLogger(json),
    payload: (data) => {
      if (json) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    },
  };
}
