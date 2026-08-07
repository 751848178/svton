// Tiny zero-dependency HTTP service for the F454 parity fixture monorepo.
// Responds on GET / and GET /health.
import { createServer } from "node:http";

const port = Number(process.env.PORT || 4300);

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "parity-api", ts: new Date().toISOString() }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("Parity API\n");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[parity-api] listening on :${port}`);
});
