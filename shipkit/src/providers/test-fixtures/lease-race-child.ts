// Real provider/ledger; mock SDK and barriers expose the ensure → lease window.
import { mock } from 'node:test';
const state = await import('../builder-state.js');
const file = process.env.TASK_STATE_FILE!;
const wait = () => new Promise<void>(resolve => process.once('message', () => resolve()));
mock.module('../builder-state.js', { namedExports: {
  ...state, stateFileFor: () => file,
  acquireLease: async (f: string) => {
    process.send?.({ event: 'at-acquire' });
    await wait();
    return state.acquireLease(f);
  },
} });
mock.module('../tencent-client.js', { namedExports: {
  requireCreds: () => ({ secretId: 'synthetic-sid', secretKey: 'synthetic-key' }),
  agentHealthy: async () => {
    process.send?.({ event: 'at-health' });
    await wait();
    return true;
  },
  authedBuilderStatus: async () => ({ kind: 'tencent', active: true }),
  mkCvmClient: async () => ({
    TerminateInstances: async () => { process.send?.({ event: 'terminated' }); return {}; },
    DescribeInstances: async () => ({ InstanceSet: [] }),
  }),
} });
const { TencentBuilderProvider } = await import('../tencent.js');
const cfg = { region: 'mock', zone: 'mock', instanceType: 'mock', imageId: 'mock', vpcId: 'mock', subnetId: 'mock', securityGroupIds: [], installUrl: 'http://127.0.0.1:9/unused' };
const provider = new TencentBuilderProvider(cfg, 30, '', '');
process.send?.({ event: 'ready' });
try {
  if (process.env.TASK_MODE === 'release') {
    await provider.release();
    process.send?.({ event: 'released' });
  } else {
    await provider.runExclusive(() => {}, 60_000, async () => {
      process.send?.({ event: 'task-started' });
      await wait();
    });
    process.send?.({ event: 'task-finished' });
  }
} catch (e) {
  process.send?.({ event: 'rejected', error: String(e) });
}
process.disconnect();
