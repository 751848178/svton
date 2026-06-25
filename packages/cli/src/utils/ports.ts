import net from 'net';

/** 某端口当前是否空闲（可监听）。 */
export function isPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/** 从 from 起向上查找第一个空闲端口。 */
export async function findFreePort(from: number): Promise<number> {
  let port = from;
  for (let i = 0; i < 100; i++) {
    if (await isPortFree(port)) return port;
    port++;
  }
  throw new Error(`No free port found starting from ${from}`);
}
