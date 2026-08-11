import { createServer, connect, type Server, type Socket } from "node:net";
import { tunnelDesktop } from "./release-registry-desktop-tunnel";

const OK = Buffer.from("HTTP/1.1 200 Connection Established\r\n\r\n");

describe("desktop registry tunnel sockets", () => {
  it("preserves same-chunk tunnel bytes and traffic larger than the header limit", async () => {
    const tls = Buffer.alloc(8192, 0x5a);
    const harness = await createHarness((socket) => {
      socket.once("data", () => socket.write(Buffer.concat([OK, tls])));
    });
    await expect(harness.result).resolves.toBeUndefined();
    const received = await harness.read(OK.length + tls.length);
    expect(received.subarray(0, OK.length)).toEqual(OK);
    expect(received.subarray(OK.length)).toEqual(tls);
    expect(received.toString("latin1").split(OK.toString("latin1"))).toHaveLength(2);
    await harness.close();
  });

  it("keeps forwarding after a bounded successful handshake", async () => {
    const payload = Buffer.alloc(12_000, 0x33);
    const harness = await createHarness((socket) => {
      socket.once("data", () => {
        socket.write(OK);
        socket.on("data", (chunk) => socket.write(chunk));
      });
    });
    await harness.result;
    await harness.read(OK.length);
    harness.client.write(payload);
    const received = await harness.read(OK.length + payload.length);
    expect(received.subarray(OK.length)).toEqual(payload);
    await harness.close();
  });

  it("contains a client reset after establishment", async () => {
    const harness = await createHarness((socket) => {
      socket.once("data", () => socket.write(OK));
    });
    await harness.result;
    await harness.read(OK.length);
    harness.client.on("error", () => undefined);
    harness.client.destroy(Object.assign(new Error("reset"), { code: "ECONNRESET" }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    await harness.close();
  });

  it.each([
    ["non-200", (socket: Socket) => socket.once("data", () =>
      socket.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n")), 100],
    ["oversized", (socket: Socket) => socket.once("data", () =>
      socket.write(Buffer.alloc(4097, 65))), 100],
    ["timeout", (socket: Socket) => socket.once("data", () => undefined), 30],
  ] as const)("rejects a %s engine response", async (_name, respond, timeoutMs) => {
    const harness = await createHarness(respond, timeoutMs);
    await expect(harness.result).rejects.toThrow();
    await harness.close();
  });
});

async function createHarness(respond: (socket: Socket) => void, timeoutMs = 200) {
  const sockets = new Set<Socket>();
  const engine = createServer((socket) => {
    sockets.add(socket); socket.once("close", () => sockets.delete(socket)); respond(socket);
  });
  const enginePort = await listen(engine);
  let accept!: (value: { result: Promise<void> }) => void;
  const accepted = new Promise<{ result: Promise<void> }>((resolve) => { accept = resolve; });
  const proxy = createServer((socket) => {
    sockets.add(socket); socket.once("close", () => sockets.delete(socket));
    const result = tunnelDesktop(socket, { host: "127.0.0.1", port: enginePort,
      timeoutMs });
    void result.catch(() => undefined); accept({ result });
  });
  const proxyPort = await listen(proxy);
  const client = connect({ host: "127.0.0.1", port: proxyPort });
  client.on("error", () => undefined);
  let received = Buffer.alloc(0);
  const waiters = new Set<() => void>();
  client.on("data", (chunk) => {
    received = Buffer.concat([received, chunk]); waiters.forEach((notify) => notify());
  });
  await new Promise<void>((resolve) => client.once("connect", resolve));
  const { result } = await accepted;
  return { client, result,
    read: (length: number) => waitForBytes(() => received, waiters, length),
    close: async () => {
      client.destroy(); sockets.forEach((socket) => socket.destroy());
      await Promise.all([close(engine), close(proxy)]);
    },
  };
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
    const timer = setTimeout(() => { waiters.delete(check); reject(new Error("socket timeout")); },
      1_000);
    const check = () => {
      if (read().length < length) return;
      clearTimeout(timer); waiters.delete(check); resolve(read());
    };
    waiters.add(check); check();
  });
}
