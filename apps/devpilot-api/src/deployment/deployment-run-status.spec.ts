import {
  DeploymentRunStatus,
  assertDeploymentRunTransition,
  canTransitionDeploymentRun,
  isTerminalDeploymentRunStatus,
} from './deployment-run-status';

/**
 * DeploymentRun 状态机单测（回归 P0-1：running → blocked 曾被遗漏）。
 * 钉死转换表，防止未来再回退。
 */
describe('assertDeploymentRunTransition', () => {
  const cases: Array<{ from: string; to: string; ok: boolean; label: string }> = [
    // queued
    { from: 'queued', to: 'running', ok: true, label: 'queued → running' },
    { from: 'queued', to: 'blocked', ok: true, label: 'queued → blocked' },
    { from: 'queued', to: 'cancelled', ok: true, label: 'queued → cancelled' },
    { from: 'queued', to: 'failed', ok: true, label: 'queued → failed' },
    // blocked
    { from: 'blocked', to: 'running', ok: true, label: 'blocked → running' },
    { from: 'blocked', to: 'cancelled', ok: true, label: 'blocked → cancelled' },
    { from: 'blocked', to: 'failed', ok: true, label: 'blocked → failed' },
    // running — P0-1 关键回归
    { from: 'running', to: 'blocked', ok: true, label: 'running → blocked (P0-1 regression)' },
    { from: 'running', to: 'completed', ok: true, label: 'running → completed' },
    { from: 'running', to: 'failed', ok: true, label: 'running → failed' },
    { from: 'running', to: 'cancelled', ok: true, label: 'running → cancelled' },
    // illegal
    { from: 'running', to: 'queued', ok: false, label: 'running → queued illegal' },
    { from: 'completed', to: 'running', ok: false, label: 'terminal → running illegal' },
    { from: 'failed', to: 'running', ok: false, label: 'terminal failed → running illegal' },
    { from: 'cancelled', to: 'running', ok: false, label: 'terminal cancelled → running illegal' },
  ];

  for (const { from, to, ok, label } of cases) {
    it(`${label} → ${ok ? 'legal' : 'illegal'}`, () => {
      expect(canTransitionDeploymentRun(from, to)).toBe(ok);
      if (ok) {
        expect(() => assertDeploymentRunTransition(from, to)).not.toThrow();
      } else {
        expect(() => assertDeploymentRunTransition(from, to)).toThrow(
          /illegal deployment run transition/,
        );
      }
    });
  }

  it('same-status transition is legal (idempotent)', () => {
    expect(() => assertDeploymentRunTransition('running', 'running')).not.toThrow();
    expect(() => assertDeploymentRunTransition('completed', 'completed')).not.toThrow();
  });

  it('empty from is legal (initial create)', () => {
    expect(() => assertDeploymentRunTransition('', DeploymentRunStatus.RUNNING)).not.toThrow();
    expect(() => assertDeploymentRunTransition(undefined as unknown as string, 'running')).not.toThrow();
  });
});

describe('isTerminalDeploymentRunStatus', () => {
  it('flags completed/failed/cancelled as terminal', () => {
    expect(isTerminalDeploymentRunStatus('completed')).toBe(true);
    expect(isTerminalDeploymentRunStatus('failed')).toBe(true);
    expect(isTerminalDeploymentRunStatus('cancelled')).toBe(true);
  });

  it('flags queued/running/blocked as non-terminal', () => {
    expect(isTerminalDeploymentRunStatus('queued')).toBe(false);
    expect(isTerminalDeploymentRunStatus('running')).toBe(false);
    expect(isTerminalDeploymentRunStatus('blocked')).toBe(false);
  });
});
