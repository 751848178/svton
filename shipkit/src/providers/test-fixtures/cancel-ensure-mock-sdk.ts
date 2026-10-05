// S06 test fixture: a scripted tencentcloud-sdk-nodejs-cvm replacement. Loaded
// via `node --import` BEFORE the real provider so its dynamic import receives
// this fake. Every call is appended to $MOCK_SDK_LOG as JSON lines so the
// parent test can prove TerminateInstances really ran for OUR instance.

import { mock } from 'node:test';
import { appendFileSync } from 'node:fs';

const INSTANCE = 'ins-s06-cancel-1';

function record(entry: Record<string, unknown>): void {
  const file = process.env.MOCK_SDK_LOG;
  if (file) appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

class Client {
  constructor(cfg: { region: string }) {
    record({ method: 'ctor', region: cfg.region });
  }

  async RunInstances(_req: unknown): Promise<{ InstanceIdSet: string[] }> {
    record({ method: 'RunInstances', slow: Boolean(process.env.MOCK_RUNINSTANCES_DELAY_MS) });
    const delay = Number(process.env.MOCK_RUNINSTANCES_DELAY_MS ?? 0);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    return { InstanceIdSet: [INSTANCE] };
  }

  async DescribeInstancesActionTimer(req: { InstanceIds: string[] }): Promise<{ ActionTimers: Array<{ InstanceId: string; TimerAction: string; Status: string; ActionTime: string }> }> {
    record({ method: 'DescribeInstancesActionTimer', ids: req.InstanceIds });
    // match the provider's default 120-minute lifetime within its 3-minute tolerance
    const at = new Date(Date.now() + 120 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return { ActionTimers: [{ InstanceId: req.InstanceIds[0] ?? INSTANCE, TimerAction: 'TerminateInstances', Status: 'UNDO', ActionTime: at }] };
  }

  async DescribeInstances(req: { InstanceIds: string[] }): Promise<{ InstanceSet: Array<{ InstanceStatus: string; PublicIpAddresses: string[] }> }> {
    record({ method: 'DescribeInstances', ids: req.InstanceIds });
    return { InstanceSet: [{ InstanceStatus: 'RUNNING', PublicIpAddresses: ['203.0.113.10'] }] };
  }

  async TerminateInstances(req: { InstanceIds: string[] }): Promise<Record<string, never>> {
    record({ method: 'TerminateInstances', ids: req.InstanceIds });
    return {};
  }
}

mock.module('tencentcloud-sdk-nodejs-cvm', {
  namedExports: {
    default: { cvm: { v20170312: { Client } } },
    cvm: { v20170312: { Client } },
  },
});
