// S06 test fixture: the CHILD process. Runs the REAL TencentBuilderProvider
// (with the mocked SDK from --import) under the real withBuilderLease signal
// guard, against an isolated HOME (own builder ledger). CHILD_MODE:
//   cancel  — the builder agent never becomes healthy; the parent signals
//             mid-provisioning; the guard must cooperatively cancel ensure and
//             actively terminate the instance it persisted.
//   control — a local /health server makes provisioning SUCCEED; the task runs
//             and the normal completion path releases the machine.

import { createServer } from 'node:http';
import { TencentBuilderProvider } from '../tencent.js';
import { withBuilderLease } from '../../cli/builder-lease.js';
import type { TencentCvmConfig } from '../../shared/types.js';

const mode = process.env.CHILD_MODE ?? 'cancel';
process.env.TENCENTCLOUD_SECRET_ID = 'AKIDmock';
process.env.TENCENTCLOUD_SECRET_KEY = 'mock-key';

const cfg: TencentCvmConfig = {
  region: 'ap-mock',
  zone: 'ap-mock-1',
  instanceType: 'S5.MOCK',
  imageId: 'img-mock',
  vpcId: 'vpc-mock',
  subnetId: 'subnet-mock',
  securityGroupIds: ['sg-mock'],
  installUrl: 'http://127.0.0.1:9/never-used', // skip the real bundle server
  installToken: 'mock-token',
  agentHost: '127.0.0.1',
  agentPort: Number(process.env.CHILD_AGENT_PORT ?? 47065),
};

const provider = new TencentBuilderProvider(cfg, 0, process.cwd(), process.cwd());

let server: ReturnType<typeof createServer> | null = null;
if (mode === 'control') {
  server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server?.listen(cfg.agentPort, '127.0.0.1', resolve));
}

const keep = setInterval(() => {}, 3_600_000); // keep the loop alive (unsettled TLA would bypass signal handlers)
try {
  await withBuilderLease({
    config: { builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: cfg } } } as never,
    taskBudgetMs: 60_000,
    log: {
      info: (m: string, meta?: Record<string, unknown>) => console.log('LOG', m, JSON.stringify(meta ?? {})),
      warn: (m: string, meta?: Record<string, unknown>) => console.log('LOG', m, JSON.stringify(meta ?? {})),
    },
    providerFactory: async () => provider,
    run: async () => {
      console.log('RUN-REACHED');
      return 'done';
    },
  });
  console.log('DONE-NORMALLY');
} catch (e) {
  console.log('LEASE-ERROR', String((e as Error).message));
} finally {
  clearInterval(keep);
  server?.close();
}
