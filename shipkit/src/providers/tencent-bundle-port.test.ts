// Exercise real HTTP bundle rendering through the provider's cloud-init flow.
// Only the cloud API/agent health are faked; no cloud instance or Docker is used.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TencentCvmConfig } from '../shared/types.js';
import type { BundleServer } from './bundle-server.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const realBundle = await import('./bundle-server.js');
const fx: { bundle?: BundleServer; installer: string; actionTime: string; healthUrls: string[] } = {
  installer: '', actionTime: '', healthUrls: [],
};
mock.module('./bundle-server.js', {
  namedExports: {
    ...realBundle,
    startBundleServer: async (opts: Parameters<typeof realBundle.startBundleServer>[0]) => {
      fx.bundle = await realBundle.startBundleServer(opts);
      return fx.bundle;
    },
  },
});
mock.module('./tencent-client.js', {
  namedExports: {
    requireCreds: () => ({ secretId: 'fixture-id', secretKey: 'fixture-key' }),
    mkCvmClient: async () => ({
      RunInstances: async (req: { UserData: string; ActionTimer: { ActionTime: string } }) => {
        const cloudInit = Buffer.from(req.UserData, 'base64').toString('utf8');
        const url = /curl -fsSL '([^']+)'/.exec(cloudInit)?.[1];
        assert.ok(url, 'cloud-init must point at the actual installer');
        const entry = new URL(url);
        assert.ok(fx.bundle);
        // Stand in for the HTTPS reverse proxy, preserving the path and query.
        const local = `http://127.0.0.1:${fx.bundle.port}${entry.pathname}${entry.search}`;
        const res = await fetch(local);
        assert.equal(res.status, 200);
        fx.installer = await res.text();
        fx.actionTime = req.ActionTimer.ActionTime;
        return { InstanceIdSet: ['ins-port-fixture'] };
      },
      DescribeInstances: async () => ({ InstanceSet: [{ PublicIpAddresses: ['192.0.2.10'] }] }),
      DescribeInstancesActionTimer: async () => ({ ActionTimers: [{
        InstanceId: 'ins-port-fixture', TimerAction: 'TerminateInstances', Status: 'UNDO', ActionTime: fx.actionTime,
      }] }),
    }),
    agentHealthy: async (url: string) => { fx.healthUrls.push(url); return true; },
    terminateQuietly: async () => {},
    authedBuilderStatus: async () => ({ kind: 'tencent', active: true }),
  },
});
const { TencentBuilderProvider } = await import('./tencent.js');

const cases: Array<{ name: string; config: Partial<TencentCvmConfig>; endpoint: string; listen: number }> = [
  { name: 'HTTP defaults', config: {}, endpoint: 'http://192.0.2.10:7410', listen: 7410 },
  {
    name: 'custom HTTP agent port with HTTPS bundle distribution',
    config: { agentPort: 17410, bundleBaseUrl: 'https://bundle.example.test' },
    endpoint: 'http://192.0.2.10:17410', listen: 17410,
  },
  {
    name: 'HTTPS port 443 uses the internal HTTP listener',
    config: { agentScheme: 'https', agentHost: 'builder.example.test', agentPort: 443, bundleBaseUrl: 'https://bundle.example.test' },
    endpoint: 'https://builder.example.test:443', listen: 7410,
  },
  {
    name: 'custom HTTPS entry port is independent of HTTP bundle distribution',
    config: { agentScheme: 'https', agentHost: 'builder.example.test', agentPort: 8443 },
    endpoint: 'https://builder.example.test:8443', listen: 7410,
  },
];

for (const c of cases) test(`bootstrap agent port: ${c.name}`, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-bundle-port-'));
  const oldHome = process.env.HOME;
  process.env.HOME = dir;
  fx.bundle = undefined;
  fx.installer = '';
  fx.healthUrls = [];
  try {
    const distDir = path.join(dir, 'dist');
    await mkdir(path.join(distDir, 'agent'), { recursive: true });
    await writeFile(path.join(distDir, 'agent', 'server.js'), '// fixture; never executed\n');
    const cfg: TencentCvmConfig = {
      region: 'r', zone: 'z', instanceType: 't', imageId: 'i', vpcId: 'v', subnetId: 's', securityGroupIds: ['sg'],
      advertiseHost: '127.0.0.1', bundlePort: 0, ...c.config,
    };
    const provider = new TencentBuilderProvider(cfg, 0, distDir, path.join(REPO, 'bootstrap'));
    const handle = await provider.ensure(() => {});
    assert.equal(handle.url, c.endpoint);
    assert.deepEqual(fx.healthUrls, [c.endpoint]);
    assert.match(fx.installer, new RegExp(`AGENT_PORT_TPL='${c.listen}'`));
  } finally {
    if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
    await rm(dir, { recursive: true, force: true });
  }
});
