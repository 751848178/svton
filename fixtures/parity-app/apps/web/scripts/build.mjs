import { mkdir, writeFile } from "node:fs/promises";

await mkdir(new URL("../dist", import.meta.url), { recursive: true });
await writeFile(
  new URL("../dist/index.html", import.meta.url),
  `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8" /><title>Parity Web</title></head>
<body>
  <h1>Parity Web</h1>
  <p>Built by the parity fixture monorepo under controlled-local-acceptance-v2.</p>
</body>
</html>
`,
);
console.log("[parity-web] wrote dist/index.html");
