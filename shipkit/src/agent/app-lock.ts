// Coordination primitives (F05 app locks + RA02 machine-level readers/writer):
// deploy/rollback are READERS (may run concurrently), GC execution is the sole WRITER —
// during compute/verify/delete no deploy may add new image references, and vice versa.

const locks = new Map<string, Promise<unknown>>();

export function withAppLock<T>(app: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(app) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(app, next.then(() => undefined, () => undefined));
  return next;
}

type Mode = 'r' | 'w';

let readers = 0;
let writer = false;
const queue: Array<{ mode: Mode; start: () => void }> = [];

function pump(): void {
  for (;;) {
    const next = queue[0];
    if (!next) return;
    if (next.mode === 'w') {
      if (writer || readers > 0) return;
      writer = true;
    } else {
      if (writer) return;
      readers++;
    }
    queue.shift();
    next.start();
  }
}

function enqueue<T>(mode: Mode, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      mode,
      start: () => {
        fn().then(resolve, reject).finally(() => {
          if (mode === 'w') writer = false;
          else readers--;
          pump();
        });
      },
    });
    pump();
  });
}

/** deploy/rollback run under this slot: concurrent with each other, mutually exclusive with GC */
export function withDeploySlot<T>(fn: () => Promise<T>): Promise<T> {
  return enqueue('r', fn);
}

/** GC execution runs under this slot: waits for all deploys, blocks new ones until done */
export function withGcSlot<T>(fn: () => Promise<T>): Promise<T> {
  return enqueue('w', fn);
}
