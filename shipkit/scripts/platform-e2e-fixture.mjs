import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile, readFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const execute = promisify(execFile);
export async function command(cmd, args, opts = {}) {
  const result = await execute(cmd, args, { timeout: 120_000, maxBuffer: 4 * 1024 * 1024, ...opts, env: { ...process.env, ...opts.env } });
  return result.stdout.trim();
}
export async function prepareFixture() {
  const runId = `mvp${randomUUID().replaceAll('-', '').slice(0, 10)}`;
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-platform-'));
  const project = path.join(root, 'project');
  const workRoot = path.join(root, 'agent');
  const dockerConfig = path.join(root, 'docker-config');
  await Promise.all([mkdir(project), mkdir(workRoot), mkdir(dockerConfig)]);
  await writeFile(path.join(dockerConfig, 'config.json'), JSON.stringify({ cliPluginsExtraDirs: ['/Applications/Docker.app/Contents/Resources/cli-plugins'] }));
  const env = { DOCKER_CONFIG: dockerConfig,
    DOCKER_HOST: 'unix:///Users/zhaoxingbo/.docker/run/docker.sock',
    SHIPKIT_STATE_DIR: path.join(root, 'controller-state') };
  const net = `${runId}-net`;
  const volume = `${runId}-data`;
  await command('docker', ['network', 'create', net], { env });
  await command('docker', ['volume', 'create', volume], { env });
  for (const service of ['api', 'web']) {
    await mkdir(path.join(project, service));
    await writeFile(path.join(project, service, 'Dockerfile'), 'FROM httpd:alpine\nCOPY index.html /usr/local/apache2/htdocs/index.html\n');
    await writeFile(path.join(project, service, 'index.html'), `${service}-v1 ${runId}\n`);
  }
  const token = randomUUID();
  const configPath = path.join(project, 'ship.config.json');
  await writeFile(configPath, JSON.stringify({
    builder: { mode: 'static', static: { url: 'http://127.0.0.1:19741', token } },
    runtime: { targets: { local: { url: 'http://127.0.0.1:19741', token } } },
    registry: { url: '127.0.0.1:19555', namespace: runId },
  }), { mode: 0o600 });
  await writeFile(path.join(project, 'runtime.env'), `PRIVATE_MVP_SECRET=private-${randomUUID()}\n`);
  const spec = { schemaVersion: 2, name: runId, services: {
    api: { dockerfile: 'api/Dockerfile', context: 'api', platform: 'linux/arm64', ports: ['19901:80'], envFile: 'runtime.env', healthcheck: { path: '/', hostPort: 19901, timeoutSeconds: 10 } },
    web: { dockerfile: 'web/Dockerfile', context: 'web', platform: 'linux/arm64', ports: ['19902:80'], networks: [net], volumes: [`${volume}:/usr/local/apache2/htdocs/data`], healthcheck: { path: '/', hostPort: 19902, timeoutSeconds: 10 } },
  } };
  await writeFile(path.join(project, 'ship.yaml'), JSON.stringify(spec));
  await writeFile(path.join(project, '.gitignore'), 'ship.config.json\nruntime.env\n');
  await command('git', ['init', '-b', 'main'], { cwd: project });
  await command('git', ['add', 'api', 'web', 'ship.yaml', '.gitignore'], { cwd: project });
  await command('git', ['-c', 'user.name=Shipkit Isolated Test', '-c', 'user.email=shipkit-test@localhost', 'commit', '-m', 'isolated fixture v1'], { cwd: project });
  const agentLog = path.join(root, 'agent.log');
  const log = await open(agentLog, 'a', 0o600);
  const child = spawn(process.execPath, [path.join(repo, 'shipkit/dist/agent/server.js')], {
    cwd: repo, env: { ...process.env, ...env, SHIP_AGENT_TOKEN: token, SHIP_AGENT_PORT: '19741', SHIP_AGENT_HOST: '127.0.0.1', SHIP_WORK_ROOT: workRoot },
    stdio: ['ignore', log.fd, log.fd],
  });
  child.once('exit', () => void log.close());
  const fixture = { root, project, workRoot, configPath, runId, net, volume, token, spec, env, agentPid: child.pid, agentLog };
  await writeFile('/tmp/codex-tool-runs/svton/platform-fixture.json', JSON.stringify(fixture), { mode: 0o600 });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:19741/health')).ok) return { fixture, child }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Isolated Agent did not start; see ${agentLog}`);
}
export async function readFixture() { return JSON.parse(await readFile('/tmp/codex-tool-runs/svton/platform-fixture.json', 'utf8')); }
