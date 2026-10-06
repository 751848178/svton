import { createServer } from "node:http";

const port = Number(process.argv[2]);
if (![4310, 4311].includes(port)) {
  throw new Error("PARITY_WEB_PORT_INVALID");
}

createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(204).end();
    return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end("<h1>Parity Web</h1>");
}).listen(port, "127.0.0.1");
