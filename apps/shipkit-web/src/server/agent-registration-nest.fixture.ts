import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Runs the actual compiled AppModule with an isolated migrated SQLite fixture. */
async function main() {
  const compiled = process.env.GATEWAY_QA_API_DIST;
  if (!compiled || !path.isAbsolute(compiled) || !process.send) throw new Error('Missing isolated API build');
  const apiRequire = createRequire(path.join(compiled, 'app.module.js'));
  apiRequire('reflect-metadata');
  const load = (file: string) => import(pathToFileURL(path.join(compiled, file)).href);
  const { databaseFixture } = await load('testing/database.fixture.js');
  const fixture = await databaseFixture();
  const { NestFactory } = apiRequire('@nestjs/core');
  const { AppModule } = await load('app.module.js');
  const app = await NestFactory.create(AppModule, { logger: false });
  const observed: { path: string; host: string | undefined; ingress: boolean; edge: boolean }[] = [];
  app.use((request: { url: string; headers: Record<string, string | undefined> }, _response: unknown, next: () => void) => {
    if (observed.length < 256) observed.push({ path: request.url, host: request.headers.host,
      ingress: request.headers['x-shipkit-agent-ingress'] !== undefined, edge: request.headers['x-shipkit-agent-edge'] !== undefined });
    next();
  });
  await app.listen(0, '127.0.0.1');
  const password = randomBytes(24).toString('base64url'), username = 'gateway-fixture-human';
  await fixture.seedAccount(username, password);
  let closing = false;
  const close = async () => {
    if (closing) return; closing = true;
    await app.close(); await fixture.dispose(); process.exit(0);
  };
  process.on('SIGTERM', () => { void close(); }); process.on('SIGINT', () => { void close(); });
  process.on('message', (message: { type?: string; id?: string }) => {
    if (message.type === 'close') { void close(); return; }
    if (message.type === 'snapshot') {
      void Promise.all([fixture.db.agent.count(), fixture.db.agentEnrollment.count(), fixture.db.agentSession.count(), fixture.db.audit.count()])
        .then(([agents, enrollments, sessions, audits]) => process.send!({ type: 'snapshot', id: message.id,
          counts: { agents, enrollments, sessions, audits }, observed }));
    }
  });
  process.send({ type: 'ready', port: Number(new URL(await app.getUrl()).port), username, password });
}
void main().catch(() => { process.send?.({ type: 'failed' }); process.exitCode = 1; });
