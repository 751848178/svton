import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdir, mkdtemp, open, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { agentGatewayFixture } from './agent-registration-base.fixture';
import { gatewayTlsFixture } from './agent-registration-tls.fixture';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const api = path.join(repo, 'apps/shipkit-api'), web = path.join(repo, 'apps/shipkit-web');

async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolve => {
    child.once('exit', () => { clearTimeout(deadline); resolve(); });
    const deadline = setTimeout(() => child.kill('SIGKILL'), 5000); child.kill('SIGTERM');
  });
}
async function port() {
  const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = (server.address() as { port: number }).port; await new Promise<void>(resolve => server.close(() => resolve())); return value;
}
async function run(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, log: string) {
  const output = await open(log, 'wx', 0o600);
  try {
    const child = spawn(file, args, { cwd, env, stdio: ['ignore', output.fd, output.fd] });
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Isolated build exceeded deadline')); }, 180000);
      child.once('error', error => { clearTimeout(deadline); reject(error); });
      child.once('exit', code => { clearTimeout(deadline); code === 0 ? resolve() : reject(new Error(`Isolated build failed (${code})`)); });
    });
  } finally { await output.close(); }
}

/** Standard next build/start copies only this app; CJS API output and migrated DB are isolated. */
export async function gatewayProductionFixture(options: { tlsHostname?: 'shipkit.fixture' | 'localhost' } = {}) {
  if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Gateway acceptance requires Node22');
  const base = path.resolve(process.env.SHIPKIT_AGENT_GATEWAY_QA_DIR ?? path.join(os.tmpdir(), 'shipkit-gateway-qa'));
  await mkdir(base, { recursive: true, mode: 0o700 }); const directory = await mkdtemp(path.join(base, 'run-'));
  const proofs = await agentGatewayFixture(), tls = await gatewayTlsFixture(proofs.directory, proofs.edge, options.tlsHostname);
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, LANG: 'en_US.UTF-8',
    NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', SHIPKIT_AGENT_INGRESS_MODE: 'trusted-proxy',
    SHIPKIT_AGENT_GATEWAY_MODE: 'trusted-edge', SHIPKIT_AGENT_PUBLIC_ORIGIN: tls.origin,
    SHIPKIT_PUBLIC_ORIGIN: tls.origin, SHIPKIT_AGENT_EDGE_PROOF_FILE: proofs.edgeFile, SHIPKIT_AGENT_INGRESS_PROOF_FILE: proofs.apiFile };
  let nest: ChildProcess | undefined, next: ChildProcess | undefined;
  const close = async () => { await stop(next); await tls.close(); await stop(nest); await proofs.close(); };
  try {
    const compiled = path.join(directory, 'api-dist');
    await run(process.execPath, [path.join(api, 'node_modules/typescript/bin/tsc'), '-p', path.join(api, 'tsconfig.json'), '--outDir', compiled], api, env, path.join(directory, 'api-build.log'));
    await symlink(path.join(api, 'generated'), path.join(directory, 'generated'), 'dir');
    await symlink(path.join(api, 'node_modules'), path.join(compiled, 'node_modules'), 'dir');
    env.GATEWAY_QA_API_DIST = compiled;
    const nestLog = await open(path.join(directory, 'nest.log'), 'wx', 0o600);
    nest = spawn(process.execPath, ['--import', path.join(api, 'node_modules/tsx/dist/loader.mjs'),
      path.join(web, 'src/server/agent-registration-nest.fixture.ts')], { cwd: api, env, stdio: ['ignore', nestLog.fd, nestLog.fd, 'ipc'] });
    await nestLog.close();
    const ready: { port: number; username: string; password: string } = await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('Compiled Nest fixture did not become ready')), 30000);
      nest!.on('message', (message: any) => {
        if (message.type === 'ready') { clearTimeout(deadline); resolve(message); }
        if (message.type === 'failed') { clearTimeout(deadline); reject(new Error('Compiled Nest fixture failed')); }
      }); nest!.once('exit', () => { clearTimeout(deadline); reject(new Error('Compiled Nest fixture exited before ready')); });
    });
    env.SHIPKIT_API_PORT = String(ready.port);
    const copy = path.join(directory, 'web'); await mkdir(copy, { mode: 0o700 });
    for (const entry of ['src', 'public', 'package.json', 'next.config.mjs', 'next-env.d.ts', 'tsconfig.json', 'tailwind.config.cjs', 'postcss.config.cjs']) {
      await cp(path.join(web, entry), path.join(copy, entry), { recursive: true });
    }
    await symlink(path.join(web, 'node_modules'), path.join(copy, 'node_modules'), 'dir');
    const cli = path.join(web, 'node_modules/next/dist/bin/next');
    await run(process.execPath, [cli, 'build'], copy, env, path.join(directory, 'next-build.log'));
    let launches = 0;
    const launch = async (enabled = true) => {
      await stop(next); const listen = await port(), output = await open(path.join(directory, `next-start-${++launches}.log`), 'wx', 0o600);
      const nextEnv = { ...env };
      if (!enabled) {
        delete nextEnv.SHIPKIT_AGENT_GATEWAY_MODE; delete nextEnv.SHIPKIT_AGENT_EDGE_PROOF_FILE;
        delete nextEnv.SHIPKIT_AGENT_INGRESS_PROOF_FILE;
      }
      next = spawn(process.execPath, [cli, 'start', '-H', '127.0.0.1', '-p', String(listen)], { cwd: copy,
        env: nextEnv, stdio: ['ignore', output.fd, output.fd] });
      await output.close();
      for (let attempt = 0; attempt < 100; attempt++) {
        if (next.exitCode !== null) throw new Error('Actual Next fixture exited');
        try { if ((await fetch(`http://127.0.0.1:${listen}/api/health`)).status === 200) { tls.setNextPort(listen); return listen; } } catch { /* Bounded readiness. */ }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Actual Next fixture did not become ready');
    };
    const nextPort = await launch();
    const snapshot = () => new Promise<any>((resolve, reject) => {
      const id = randomUUID(), deadline = setTimeout(() => { nest!.off('message', message); reject(new Error('Snapshot timed out')); }, 5000);
      const message = (value: any) => { if (value.type === 'snapshot' && value.id === id) { clearTimeout(deadline); nest!.off('message', message); resolve(value); } };
      nest!.on('message', message); nest!.send({ type: 'snapshot', id });
    });
    const proof = (value: unknown) => writeFile(path.join(directory, 'acceptance-proof.json'), JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    return { directory, proofs, tls, nextPort, ready, snapshot, launch, proof, close };
  } catch (error) { await close(); throw error; }
}
