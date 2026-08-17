import type { Socket } from "node:net";

export type BoundedHeader = { header: Buffer; remaining: Buffer };

export function readBoundedSocketHeader(socket: Socket, options: {
  maxBytes?: number;
  timeoutMs?: number;
  abortSocket?: Socket;
} = {}) {
  return new Promise<BoundedHeader>((resolve, reject) => {
    const limit = options.maxBytes ?? 4096;
    let value = Buffer.alloc(0);
    let settled = false;
    const timer = setTimeout(() => finish(new Error("socket header timeout")),
      options.timeoutMs ?? 5_000);
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
      socket.removeListener("end", onEnd);
      socket.removeListener("close", onClose);
      options.abortSocket?.removeListener("error", onAbortError);
      options.abortSocket?.removeListener("end", onAbortEnd);
      options.abortSocket?.removeListener("close", onAbortClose);
    };
    const finish = (error?: Error, result?: BoundedHeader) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(result!);
    };
    const onData = (chunk: Buffer) => {
      value = Buffer.concat([value, chunk]);
      const boundary = value.indexOf("\r\n\r\n");
      if (boundary < 0) {
        if (value.length > limit) finish(new Error("socket header too large"));
        return;
      }
      const end = boundary + 4;
      if (end > limit) { finish(new Error("socket header too large")); return; }
      finish(undefined, { header: value.subarray(0, end), remaining: value.subarray(end) });
    };
    const onError = (error: Error) => finish(error);
    const onEnd = () => finish(new Error("socket ended before header"));
    const onClose = () => finish(new Error("socket closed before header"));
    const onAbortError = (error: Error) => finish(error);
    const onAbortEnd = () => finish(new Error("peer ended before header"));
    const onAbortClose = () => finish(new Error("peer closed before header"));
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("end", onEnd);
    socket.once("close", onClose);
    options.abortSocket?.once("error", onAbortError);
    options.abortSocket?.once("end", onAbortEnd);
    options.abortSocket?.once("close", onAbortClose);
    if (socket.destroyed || options.abortSocket?.destroyed)
      finish(new Error("socket closed before header"));
  });
}

export function wireBidirectionalTunnel(left: Socket, right: Socket, prefixes: {
  toLeft?: Buffer;
  toRight?: Buffer;
} = {}) {
  left.on("error", () => right.destroy());
  right.on("error", () => left.destroy());
  left.on("end", () => right.end());
  right.on("end", () => left.end());
  left.on("close", () => { if (!right.destroyed) right.destroy(); });
  right.on("close", () => { if (!left.destroyed) left.destroy(); });
  if (prefixes.toLeft?.length) left.write(prefixes.toLeft);
  if (prefixes.toRight?.length) right.write(prefixes.toRight);
  left.pipe(right, { end: false });
  right.pipe(left, { end: false });
}
