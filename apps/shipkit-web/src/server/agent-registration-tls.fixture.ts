import { spawnSync } from 'node:child_process';
import { chmod, readFile } from 'node:fs/promises';
import { createServer, request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import type { TLSSocket } from 'node:tls';

/** A real TLS edge: raw duplicate rejection precedes proof injection and actual Next routing. */
export async function gatewayTlsFixture(directory: string, proof: string, hostname: 'shipkit.fixture' | 'localhost' = 'shipkit.fixture') {
  if (!['shipkit.fixture', 'localhost'].includes(hostname)) throw new Error('Fixture TLS hostname is unsupported');
  const key = path.join(directory, 'tls-key.pem'), cert = path.join(directory, 'tls-cert.pem');
  const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', key, '-out', cert, '-subj', `/CN=${hostname}`, '-addext', `subjectAltName=DNS:${hostname}`],
  { stdio: 'ignore', timeout: 15000 });
  if (generated.status !== 0) throw new Error('Fixture TLS certificate generation failed');
  await chmod(key, 0o600); await chmod(cert, 0o600);
  const ca = await readFile(cert); let nextPort = 0, origin = '', forwarded = 0, rawRejected = 0;
  const server = createServer({ key: await readFile(key), cert: ca }, (request, response) => {
    const machine = request.url?.startsWith('/api/agent-registration/') ?? false;
    const deny = () => { rawRejected++; response.writeHead(403); response.end('{}'); };
    if ((request.socket as TLSSocket & { servername?: string }).servername !== hostname
      || request.headers.host !== new URL(origin).host) { deny(); return; }
    if (machine) {
      const names = request.rawHeaders.filter((_value, index) => index % 2 === 0).map(value => value.toLowerCase());
      if (new Set(names).size !== names.length || names.some(name => name.startsWith('x-forwarded-')
        || name.startsWith('x-shipkit-') || ['cookie', 'forwarded'].includes(name))) { deny(); return; }
    }
    const headers: Record<string, string | string[] | undefined> = { ...request.headers, host: new URL(origin).host };
    delete headers['x-shipkit-agent-edge']; delete headers['x-shipkit-agent-ingress']; delete headers.forwarded;
    for (const name of Object.keys(headers)) if (name.startsWith('x-forwarded-')) delete headers[name];
    headers['x-forwarded-proto'] = 'https'; headers['x-forwarded-host'] = new URL(origin).host;
    headers['x-forwarded-port'] = new URL(origin).port; headers['x-forwarded-for'] = '127.0.0.1';
    if (machine) headers['x-shipkit-agent-edge'] = proof;
    forwarded++;
    const upstream = httpRequest({ hostname: '127.0.0.1', port: nextPort, path: request.url, method: request.method, headers }, incoming => {
      response.writeHead(incoming.statusCode ?? 502, incoming.headers); incoming.pipe(response);
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end('{}'); });
    upstream.setTimeout(8000, () => upstream.destroy());
    request.on('aborted', () => upstream.destroy()); request.pipe(upstream);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port; origin = `https://${hostname}:${port}`;
  const send = (route: string, body: unknown = {}, extra: Record<string, string> = {}, method = 'POST', trust = true,
    rawHeaders?: string[]) => new Promise<{ status: number; body: Record<string, any>; cookie?: string; secureCookie: boolean; tlsAuthorized: boolean }>((resolve, reject) => {
    const bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const request = httpsRequest({ hostname: '127.0.0.1', port, servername: hostname, rejectUnauthorized: true,
      ...(trust ? { ca } : {}), path: route, method, headers: rawHeaders ?? {
        host: new URL(origin).host, 'content-type': 'application/json', ...(method === 'GET' || method === 'HEAD' ? {} : { 'content-length': String(bytes.length) }), ...extra,
      } }, response => {
        const tlsAuthorized = (response.socket as TLSSocket).authorized;
        const chunks: Buffer[] = []; let total = 0;
        response.on('data', chunk => { total += chunk.length; if (total > 32768) request.destroy(new Error('Fixture response budget exceeded')); else chunks.push(chunk); });
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed: Record<string, any> = {}; try { parsed = JSON.parse(text); } catch { /* Wrong-route HTML is not a receipt. */ }
          resolve({ status: response.statusCode ?? 0, body: parsed, cookie: response.headers['set-cookie']?.[0]?.split(';')[0],
            secureCookie: /;\s*Secure(?:;|$)/i.test(response.headers['set-cookie']?.[0] ?? ''), tlsAuthorized });
        }); response.on('error', reject);
      });
    request.setTimeout(10000, () => request.destroy(new Error('Fixture TLS request timed out'))); request.on('error', reject);
    request.end(method === 'GET' || method === 'HEAD' ? undefined : bytes);
  });
  return { origin, ca, caFile: cert, send, setNextPort: (value: number) => { nextPort = value; },
    get counters() { return { forwarded, rawRejected }; },
    close: () => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }) };
}
