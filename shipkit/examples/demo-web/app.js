// Minimal demo app for the shipkit end-to-end walkthrough.
const http = require('node:http');

const port = Number(process.env.PORT || 3000);
const version = process.env.APP_VERSION || '0.0.0';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`demo-web ${version} on ${port}\n`);
});

server.listen(port, () => console.log(`demo-web ${version} listening on ${port}`));
