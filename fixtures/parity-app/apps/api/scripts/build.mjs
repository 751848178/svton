import { mkdir, copyFile } from "node:fs/promises";

await mkdir(new URL("../dist", import.meta.url), { recursive: true });
await copyFile(
  new URL("../src/server.js", import.meta.url),
  new URL("../dist/server.js", import.meta.url),
);
console.log("[parity-api] copied src/server.js -> dist/server.js");
