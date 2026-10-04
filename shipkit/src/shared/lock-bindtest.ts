// Kernel primitives shared by the lock registry and the lock itself.
//  - bindTest: "is anything bound here right now?" (never terminates anyone)
//  - bindHold/closeHold: a HELD listener — kernel-exclusive for the duration;
//    used as the per-key ALLOCATION mutex serializing claim publication
//  - probeBanner: identify a port's occupant by its shiplock banner (pid +
//    keyhash) within a caller-supplied budget; settles exactly once on every
//    data/end/close/error/timeout path

import { createServer, connect, type Server, type Socket } from 'node:net';

export function bindTest(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    // a straggler connection accepted from the just-closing backlog would
    // otherwise never end and stall server.close() forever
    server.on('connection', (socket) => socket.destroy());
    const settle = (ok: boolean) => {
      server.removeAllListeners('error');
      server.close(() => undefined);
      (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
      resolve(ok);
    };
    server.once('error', () => settle(false));
    server.listen(port, '127.0.0.1', () => settle(true));
  });
}

/** hold the port for the caller's critical section; null = someone else holds */
export function bindHold(port: number, banner: string): Promise<Server | null> {
  return new Promise((resolve) => {
    const server = createServer();
    const sockets = new Set<Socket>();
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
      socket.end(banner);
    });
    (server as unknown as { __sockets?: Set<Socket> }).__sockets = sockets;
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

export function closeHold(server: Server): Promise<void> {
  const sockets = (server as unknown as { __sockets?: Set<Socket> }).__sockets;
  for (const s of sockets ?? []) s.destroy();
  return new Promise((resolve) => server.close(() => resolve()));
}

export interface BannerProbe {
  kind: 'ours' | 'other' | 'foreign' | 'none';
  pid?: string;
}

export function probeBanner(port: number, keyHash: string, budgetMs: number): Promise<BannerProbe> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (r: BannerProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(r);
    };
    timer = setTimeout(() => finish({ kind: 'none' }), Math.max(1, Math.min(budgetMs, 1200)));
    socket.once('data', (d) => {
      const text = String(d);
      if (!text.startsWith('shiplock:')) return finish({ kind: 'foreign' });
      const [, pid, hash] = text.split(':');
      finish({ kind: hash?.trim() === keyHash ? 'ours' : 'other', pid });
    });
    socket.once('end', () => finish({ kind: 'none' })); // EOF without a banner
    socket.once('close', () => finish({ kind: 'none' }));
    socket.once('error', () => finish({ kind: 'none' }));
  });
}
