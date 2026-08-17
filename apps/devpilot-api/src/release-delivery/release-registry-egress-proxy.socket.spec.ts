import { connect, createServer, type Server, type Socket } from "node:net";
import { handleRegistryProxyClient } from "./release-registry-egress-proxy-handler";

const CONNECT = "CONNECT registry.npmjs.org:443 HTTP/1.1\r\n"+
  "Host: registry.npmjs.org:443\r\n\r\n";
const ESTABLISHED = Buffer.from("HTTP/1.1 200 Connection Established\r\n\r\n");

describe("direct registry proxy socket lifecycle", () => {
  it("contains resets in every phase and continues accepting tunnels", async () => {
    const harness = await createHarness();

    await resetClient(harness.port, "CONN");
    await harness.assertUsable("after-partial-reset");

    await resetClient(harness.port, "CONNECT evil.test:443 HTTP/1.1\r\n\r\n");
    await harness.assertUsable("after-rejected-reset");

    const established = await openClient(harness.port);
    established.socket.write(CONNECT);
    await established.read(ESTABLISHED.length);
    established.socket.destroy(resetError());
    await delay(20);
    await harness.assertUsable("after-established-reset");

    await harness.close();
  });
});

async function createHarness() {
  const sockets = new Set<Socket>();
  const registry = createServer((socket) => {
    track(socket, sockets); socket.pipe(socket);
  });
  const registryPort = await listen(registry);
  const proxy = createServer((client) => {
    track(client, sockets);
    void handleRegistryProxyClient(client, {
      mode: "direct-public-dns-v1",
      headerTimeoutMs: 100,
      connectTimeoutMs: 100,
      resolveAddresses: async () => ["104.16.1.35"],
      connectDirect: () => connect({ host: "127.0.0.1", port: registryPort }),
    });
  });
  const port = await listen(proxy);
  return { port,
    assertUsable: async (payload: string) => {
      const client = await openClient(port);
      client.socket.write(CONNECT);
      await client.read(ESTABLISHED.length);
      client.socket.write(payload);
      const received = await client.read(ESTABLISHED.length + payload.length);
      expect(received.subarray(0, ESTABLISHED.length)).toEqual(ESTABLISHED);
      expect(received.subarray(ESTABLISHED.length).toString()).toBe(payload);
      client.socket.end();
    },
    close: async () => {
      sockets.forEach((socket) => socket.destroy());
      await Promise.all([close(proxy), close(registry)]);
    },
  };
}

async function resetClient(port: number, value: string) {
  const client = await openClient(port);
  client.socket.write(value);
  client.socket.destroy(resetError());
  await delay(20);
}

async function openClient(port: number) {
  const socket = connect({ host: "127.0.0.1", port });
  socket.on("error", () => undefined);
  let received = Buffer.alloc(0);
  const waiters = new Set<() => void>();
  socket.on("data", (chunk) => {
    received = Buffer.concat([received, chunk]); waiters.forEach((notify) => notify());
  });
  await new Promise<void>((resolve) => socket.once("connect", resolve));
  return { socket, read: (length: number) => waitForBytes(
    () => received, waiters, length) };
}

function track(socket: Socket, sockets: Set<Socket>) {
  sockets.add(socket);
  socket.on("error", () => undefined);
  socket.once("close", () => sockets.delete(socket));
}

function listen(server: Server) {
  return new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () =>
    resolve((server.address() as { port: number }).port)));
}

function close(server: Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

function waitForBytes(read: () => Buffer, waiters: Set<() => void>, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => { waiters.delete(check); reject(new Error("timeout")); }, 500);
    const check = () => {
      if (read().length < length) return;
      clearTimeout(timer); waiters.delete(check); resolve(read());
    };
    waiters.add(check); check();
  });
}

function resetError() {
  return Object.assign(new Error("reset"), { code: "ECONNRESET" });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
