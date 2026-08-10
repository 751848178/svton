import http from "node:http";

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(
    "<!doctype html><title>F570</title><main>F570 session identity</main>",
  );
});

server.listen(0, "127.0.0.1", () => {
  process.stdout.write(`${server.address().port}\n`);
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
