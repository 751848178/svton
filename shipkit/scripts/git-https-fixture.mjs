import https from 'node:https';
import { spawn } from 'node:child_process';

export async function gitHttpsFixture({ key, cert, repositoryRoot, backend, token }) {
  const evidence = { authorized: 0, challenged: 0, receivePackRequests: 0, failures: 0 };
  const authorization = `Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
  const server = https.createServer({ key, cert }, async (request, response) => {
    if (request.headers.authorization !== authorization) {
      evidence.challenged++; response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Shipkit fixture"' }); response.end(); return;
    }
    evidence.authorized++;
    const url = new URL(request.url, 'https://localhost');
    if (url.pathname.includes('git-receive-pack') || url.searchParams.get('service') === 'git-receive-pack') {
      evidence.receivePackRequests++; response.writeHead(403); response.end(); return;
    }
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const child = spawn(backend, [], { env: { ...process.env, GIT_PROJECT_ROOT: repositoryRoot, GIT_HTTP_EXPORT_ALL: '1',
      REQUEST_METHOD: request.method, PATH_INFO: url.pathname, QUERY_STRING: url.search.slice(1), CONTENT_TYPE: request.headers['content-type'] ?? '',
      CONTENT_LENGTH: String(body.length), REMOTE_USER: 'fixture', HTTP_GIT_PROTOCOL: request.headers['git-protocol'] ?? '' }, stdio: ['pipe','pipe','pipe'] });
    const output = []; child.stdout.on('data', chunk => output.push(chunk)); child.stderr.resume(); child.stdin.end(body);
    child.once('error', () => { evidence.failures++; response.writeHead(500); response.end(); });
    child.once('close', code => {
      if (response.writableEnded) return;
      if (code) { evidence.failures++; response.writeHead(500); response.end(); return; }
      const result = Buffer.concat(output), split = result.indexOf('\r\n\r\n');
      if (split < 0) { evidence.failures++; response.writeHead(500); response.end(); return; }
      const headers = {}; let status = 200;
      for (const line of result.subarray(0, split).toString().split('\r\n')) {
        const index = line.indexOf(':'); if (index < 0) continue;
        const name = line.slice(0, index), value = line.slice(index + 1).trim();
        if (name.toLowerCase() === 'status') status = Number(value.split(' ')[0]); else headers[name] = value;
      }
      response.writeHead(status, headers); response.end(result.subarray(split + 4));
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `https://localhost:${server.address().port}`, evidence, stop: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
