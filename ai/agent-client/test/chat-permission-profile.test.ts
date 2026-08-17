import { describe, expect, it, vi } from 'vitest';
import type { PermissionMode, ReasoningEffort } from '@svton/agent-core';
import type { PermissionProfileRequest } from '../src/permission-profile/permission-profile.types';
import { ChatPermissionProfileService } from '../src/service/chat-permission-profile.service';
import type { ChatRuntimeRegistryService } from '../src/service/chat-runtime-registry.service';
import { ChatSessionSettingsLeaseService } from '../src/service/chat-session-settings-lease.service';

type Gate = 'processing' | 'streaming' | 'approval' | 'userInput';
const gates: Array<[Gate, string]> = [
  ['processing', '仍在运行'], ['streaming', '仍在运行'],
  ['approval', '等待工具审批'], ['userInput', '等待问题回答'],
];

describe('ChatPermissionProfileService', () => {
  it('applies the addressed runtime before persistence and promotes only the future default', async () => {
    const h = harness();
    const host = h.host(async (mode) => {
      expect(h.mode('target')).toBe('accept_edits');
      expect(h.mode('peer')).toBe('default');
      expect(h.defaultMode()).toBe('default');
      h.persisted = mode;
    });

    const result = await h.service.execute(request(), host, vi.fn());

    expect(result).toEqual({
      kind: 'succeeded', requestId: 'permission-1',
      active: 'accept_edits', persisted: 'accept_edits',
    });
    expect(h.defaultMode()).toBe('accept_edits');
    expect(h.mode('peer')).toBe('default');
  });

  it('rolls back a failed persistence and returns a bounded redacted error', async () => {
    const h = harness();
    const secret = 'ghp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
    const host = h.host(async () => { throw new Error(`token=${secret} ${'x'.repeat(700)}`); });

    const result = await h.service.execute(request(), host, vi.fn());

    expect(result).toMatchObject({
      kind: 'failed', code: 'persistence', active: 'default',
      persisted: 'default', rolledBack: true, activeDefaultSplit: false,
    });
    expect(result.kind === 'failed' ? result.message : '').not.toContain(secret);
    expect(result.kind === 'failed' ? result.message.length : 0).toBeLessThanOrEqual(500);
    expect(h.defaultMode()).toBe('default');
  });

  it('treats a silent persistence no-op as failure before promoting the default', async () => {
    const h = harness();
    const result = await h.service.execute(request(), h.host(async () => {}), vi.fn());

    expect(result).toMatchObject({
      kind: 'failed', code: 'persistence', active: 'default',
      persisted: 'default', rolledBack: true,
    });
    expect(h.defaultMode()).toBe('default');
  });

  it('rejects a concurrent same-session mutation while persistence is pending', async () => {
    const h = harness();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const first = h.service.execute(request(), h.host(async (mode) => {
      await wait;
      h.persisted = mode;
    }), vi.fn());
    await vi.waitFor(() => expect(h.mode('target')).toBe('accept_edits'));

    const second = await h.service.execute({
      ...request(), requestId: 'permission-2', from: 'accept_edits', to: 'auto',
    }, h.host(async () => {}), vi.fn());

    expect(second).toMatchObject({ kind: 'failed', code: 'blocked' });
    expect(h.setPermission).toHaveBeenCalledTimes(1);
    release();
    await expect(first).resolves.toMatchObject({ kind: 'succeeded' });
  });

  it.each(gates)('blocks %s before mutating the runtime', async (gate, message) => {
    const h = harness();
    h.blocked.add(gate);
    const persistDefault = vi.fn(async () => {});

    const result = await h.service.execute(
      request(), { getPersisted: () => 'default', persistDefault }, vi.fn(),
    );

    expect(result).toMatchObject({ kind: 'failed', code: 'blocked' });
    expect(result.kind === 'failed' ? result.message : '').toContain(message);
    expect(h.setPermission).not.toHaveBeenCalled();
    expect(persistDefault).not.toHaveBeenCalled();
  });

  it.each([
    ['approval' as const, '等待工具审批'],
    ['userInput' as const, '等待问题回答'],
  ])('prefers the precise %s reason over the generic active-run reason', async (gate, message) => {
    const h = harness();
    h.blocked.add('processing');
    h.blocked.add(gate);

    const result = await h.service.execute(
      request(), { getPersisted: () => 'default', persistDefault: vi.fn() }, vi.fn(),
    );

    expect(result.kind === 'failed' ? result.message : '').toContain(message);
  });

  it('cannot commit a slot whose runtime has no permission manager', async () => {
    const h = harness({ managerAbsent: true });
    const persistDefault = vi.fn(async () => {});
    const result = await h.service.execute(
      request('auto', 'default'), { getPersisted: () => 'auto', persistDefault }, vi.fn(),
    );

    expect(result).toMatchObject({ kind: 'failed', code: 'apply' });
    expect(h.setPermission).not.toHaveBeenCalled();
    expect(persistDefault).not.toHaveBeenCalled();
  });

  it('changes reasoning only on the addressed session and obeys the same gates', async () => {
    const h = harness();
    await expect(h.service.changeReasoning('r1', 'target', 'high'))
      .resolves.toEqual({ kind: 'succeeded' });
    expect(h.setReasoning).toHaveBeenCalledWith('target', 'high');
    h.blocked.add('approval');
    await expect(h.service.changeReasoning('r2', 'peer', 'low'))
      .resolves.toMatchObject({ kind: 'failed', code: 'blocked' });
    expect(h.setReasoning).not.toHaveBeenCalledWith('peer', 'low');
  });
});

function request(from: PermissionMode = 'default', to: PermissionMode = 'accept_edits'): PermissionProfileRequest {
  return { requestId: 'permission-1', sessionId: 'target', from, to };
}

function harness(options: { managerAbsent?: boolean } = {}) {
  const modes = new Map<string | null, PermissionMode>([['target', 'default'], ['peer', 'default']]);
  let creationDefault: PermissionMode = options.managerAbsent ? 'auto' : 'default';
  const blocked = new Set<Gate>();
  const setPermission = vi.fn((sessionId: string | null, mode: PermissionMode) => {
    if (options.managerAbsent) return false;
    modes.set(sessionId, mode); return true;
  });
  const setReasoning = vi.fn((_sessionId: string | null, _effort: ReasoningEffort | undefined) => true);
  const runtimes = {
    permissionMode: vi.fn((sessionId: string | null) => options.managerAbsent ? undefined : modes.get(sessionId)),
    creationPermissionMode: vi.fn(() => creationDefault), setPermissionMode: setPermission,
    commitCreationPermissionDefault: vi.fn((mode: PermissionMode) => { creationDefault = mode; return true; }),
    setReasoningEffort: setReasoning,
  } as unknown as ChatRuntimeRegistryService;
  const service = new ChatPermissionProfileService({
    runtimes, lease: new ChatSessionSettingsLeaseService(), activeSession: () => 'target',
    isProcessing: () => blocked.has('processing'), isStreaming: () => blocked.has('streaming'),
    hasApproval: () => blocked.has('approval'), hasUserInput: () => blocked.has('userInput'),
    isModelSwitchPending: () => false, publishSelected: vi.fn(),
  });
  const state = { persisted: 'default' as PermissionMode };
  return {
    service, blocked, setPermission, setReasoning,
    mode: (id: string) => modes.get(id), defaultMode: () => creationDefault,
    get persisted() { return state.persisted; }, set persisted(value: PermissionMode) { state.persisted = value; },
    host: (persistDefault: (mode: PermissionMode) => Promise<void>) => ({
      getPersisted: () => state.persisted, persistDefault,
    }),
  };
}
