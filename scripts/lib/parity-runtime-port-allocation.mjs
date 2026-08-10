import { createServer } from "node:net";

export async function allocateDistinctLoopbackPorts(count) {
  if (!Number.isInteger(count) || count < 1 || count > 32) {
    throw new Error("PARITY_RUNTIME_PORT_ALLOCATION_INVALID: count");
  }
  const ports = [];
  while (ports.length < count) {
    const port = await allocatePort();
    if (!ports.includes(port)) ports.push(port);
  }
  return Object.freeze(ports);
}

function allocatePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });
}
