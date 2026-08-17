import { describe, expect, it, vi } from 'vitest';
import {
  PermissionManager,
  ToolRegistry,
  type AgentConfig,
  type PermissionMode,
  type SvtonAgentRuntime,
} from '@svton/agent-core';
import { makeBrowserPlatform, buildPiAgentConfig } from './helpers/pi-test-utils';
import { ChatRuntimeRegistryService } from '../src/service/chat-runtime-registry.service';
import { ChatRunOwnershipService } from '../src/service/chat-run-ownership.service';
import { cloneRuntimeConfig } from '../src/service/chat-runtime-config';
import { createConfiguredRuntime } from '../src/service/chat-runtime-lifecycle';

function config(model = 'test-model'): AgentConfig {
  return { ...buildPiAgentConfig({ toolRegistry: new ToolRegistry() }).config, model };
}

function fakeRuntime(permissionMode: PermissionMode = 'default') {
  const permissions = new PermissionManager({ mode: permissionMode });
  return {
    abort: vi.fn(), reset: vi.fn(), getMessages: vi.fn(() => []),
    setReasoningEffort: vi.fn(),
    setPermissionMode: vi.fn((mode: PermissionMode) => {
      permissions.setMode(mode);
      return true;
    }),
    getPermissionMode: vi.fn(() => permissions.getMode()),
    getPermissionManager: vi.fn(() => permissions),
  } as unknown as SvtonAgentRuntime;
}

function runtimeWithoutPermissions() {
  return {
    abort: vi.fn(), reset: vi.fn(), getMessages: vi.fn(() => []),
    setReasoningEffort: vi.fn(),
    setPermissionMode: vi.fn(() => false),
    getPermissionMode: vi.fn(() => undefined),
    getPermissionManager: vi.fn(() => null),
  } as unknown as SvtonAgentRuntime;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('session runtime registry', () => {
  it('commits only the addressed slot and promotes future-session defaults only after persistence', async () => {
    const runtimeA = fakeRuntime();
    const runtimePeer = fakeRuntime();
    const runtimeB = fakeRuntime();
    const runtimeCBeforeRetry = fakeRuntime();
    const runtimeCAfterRetry = fakeRuntime();
    const create = vi.fn()
      .mockResolvedValueOnce(runtimeA)
      .mockResolvedValueOnce(runtimePeer)
      .mockResolvedValueOnce(runtimeB)
      .mockResolvedValueOnce(runtimeCBeforeRetry)
      .mockResolvedValueOnce(runtimeCAfterRetry);
    const registry = new ChatRuntimeRegistryService(create);
    const platform = makeBrowserPlatform();
    const configA = config('shared');
    const configB = { ...config('shared'), reasoningEffort: 'high' as const };
    const keyA = { providerId: 'provider-a', modelId: 'shared' };
    const keyB = { providerId: 'provider-b', modelId: 'shared' };
    registry.configure(platform, configA, 'config-a', keyA);
    await registry.ensure('a');
    await registry.ensure('peer');
    const peer = registry.get('peer');
    const candidate = await registry.prepareSwitch('a', platform, configB, keyB, 'config-b');
    expect(registry.get('a')).toBe(runtimeA);
    expect(registry.commitSwitch(candidate)).toBe(true);
    expect(registry.get('a')).toBe(runtimeB);
    expect(registry.get('peer')).toBe(peer);
    expect(registry.slot('a')?.reasoningEffort).toBe('high');
    await registry.ensure('c-before-retry');
    expect(create.mock.calls[3]?.[0]).toBe(configA);
    registry.commitCreationDefault(candidate);
    await registry.ensure('c-after-retry');
    expect(create.mock.calls[4]?.[0]).toBe(configB);
  });

  it('preserves addressed permission through model switch without mutating peer or default', async () => {
    const runtimeA = fakeRuntime('default');
    const runtimeB = fakeRuntime('default');
    const switchedA = fakeRuntime('auto');
    const registry = new ChatRuntimeRegistryService(
      vi.fn().mockResolvedValueOnce(runtimeA).mockResolvedValueOnce(runtimeB)
        .mockResolvedValueOnce(switchedA),
    );
    const platform = makeBrowserPlatform();
    const initial = config('model-a');
    initial.capabilities = {
      ...initial.capabilities,
      permissionManager: new PermissionManager({ mode: 'default' }),
    };
    registry.configure(platform, initial, 'a', {
      providerId: 'provider-a', modelId: 'model-a',
    });
    await registry.ensure('a');
    await registry.ensure('b');
    expect(registry.setPermissionMode('a', 'accept_edits')).toBe(true);

    const next = config('model-b');
    next.capabilities = {
      ...next.capabilities,
      permissionManager: new PermissionManager({ mode: 'auto' }),
    };
    const candidate = await registry.prepareSwitch(
      'a', platform, next, { providerId: 'provider-b', modelId: 'model-b' }, 'b',
    );
    expect(switchedA.setPermissionMode).toHaveBeenCalledWith('accept_edits');
    expect(registry.commitSwitch(candidate)).toBe(true);
    expect(registry.permissionMode('a')).toBe('accept_edits');
    expect(registry.permissionMode('b')).toBe('default');
    expect(registry.creationPermissionMode()).toBe('default');

    registry.commitCreationDefault(candidate);
    expect(registry.creationPermissionMode()).toBe('auto');
    expect(registry.permissionMode('b')).toBe('default');
  });

  it('does not project a creation default onto a slot without a permission manager', async () => {
    const runtime = runtimeWithoutPermissions();
    const registry = new ChatRuntimeRegistryService(vi.fn().mockResolvedValue(runtime));
    const initial = config();
    initial.capabilities = {
      ...initial.capabilities,
      permissionManager: new PermissionManager({ mode: 'auto' }),
    };
    registry.configure(makeBrowserPlatform(), initial, 'configured-default');

    await registry.ensure('manager-absent');

    expect(registry.creationPermissionMode()).toBe('auto');
    expect(registry.permissionMode('missing-slot')).toBe('auto');
    expect(registry.permissionMode('manager-absent')).toBeUndefined();
    expect(registry.setPermissionMode('manager-absent', 'default')).toBe(false);
  });

  it('deduplicates same-session creation while A and B create independently', async () => {
    const a = deferred<SvtonAgentRuntime>();
    const b = deferred<SvtonAgentRuntime>();
    const create = vi.fn()
      .mockImplementationOnce(() => a.promise)
      .mockImplementationOnce(() => b.promise);
    const registry = new ChatRuntimeRegistryService(create);
    registry.configure(makeBrowserPlatform(), config(), 'v1');
    const a1 = registry.ensure('a');
    const a2 = registry.ensure('a');
    const b1 = registry.ensure('b');
    expect(create).toHaveBeenCalledTimes(2);
    const runtimeA = fakeRuntime();
    const runtimeB = fakeRuntime();
    a.resolve(runtimeA); b.resolve(runtimeB);
    await expect(a1).resolves.toBe(runtimeA);
    await expect(a2).resolves.toBe(runtimeA);
    await expect(b1).resolves.toBe(runtimeB);
  });

  it('stores reasoning effort on only the addressed session slot', async () => {
    const runtimeA = fakeRuntime();
    const runtimeB = fakeRuntime();
    const registry = new ChatRuntimeRegistryService(
      vi.fn().mockResolvedValueOnce(runtimeA).mockResolvedValueOnce(runtimeB),
    );
    const initial = { ...config(), reasoningEffort: 'low' as const };
    registry.configure(makeBrowserPlatform(), initial, 'initial', {
      providerId: 'provider', modelId: 'test-model',
    });
    await registry.ensure('a');
    await registry.ensure('b');

    expect(registry.setReasoningEffort('a', 'high')).toBe(true);
    expect(registry.slot('a')).toMatchObject({ reasoningEffort: 'high' });
    expect(registry.slot('a')?.config?.reasoningEffort).toBeUndefined();
    expect(registry.slot('b')).toMatchObject({ reasoningEffort: 'low' });
    expect(runtimeA.setReasoningEffort).toHaveBeenCalledWith('high');
    expect(runtimeB.setReasoningEffort).not.toHaveBeenCalled();
  });

  it('keeps the new slot committed when old-runtime cleanup throws', async () => {
    const oldRuntime = fakeRuntime();
    oldRuntime.reset = vi.fn(() => { throw new Error('cleanup failed'); });
    const newRuntime = fakeRuntime();
    const registry = new ChatRuntimeRegistryService(
      vi.fn().mockResolvedValueOnce(oldRuntime).mockResolvedValueOnce(newRuntime),
    );
    const platform = makeBrowserPlatform();
    registry.configure(platform, config('model-a'), 'a', {
      providerId: 'provider-a', modelId: 'model-a',
    });
    await registry.ensure('session-a');
    const candidate = await registry.prepareSwitch(
      'session-a', platform, config('model-b'),
      { providerId: 'provider-b', modelId: 'model-b' }, 'b',
    );

    expect(registry.commitSwitch(candidate)).toBe(true);
    expect(registry.get('session-a')).toBe(newRuntime);
    expect(registry.slot('session-a')?.modelKey).toEqual({
      providerId: 'provider-b', modelId: 'model-b',
    });
    expect(candidate.disposed).toBe(true);
    expect(oldRuntime.reset).toHaveBeenCalledOnce();
  });

  it('contains prepared candidate abort and reset failures during disposal', async () => {
    const oldRuntime = fakeRuntime();
    const candidateRuntime = fakeRuntime();
    candidateRuntime.abort = vi.fn(() => { throw new Error('abort cleanup failed'); });
    candidateRuntime.reset = vi.fn(() => { throw new Error('reset cleanup failed'); });
    const registry = new ChatRuntimeRegistryService(
      vi.fn().mockResolvedValueOnce(oldRuntime).mockResolvedValueOnce(candidateRuntime),
    );
    const platform = makeBrowserPlatform();
    registry.configure(platform, config('model-a'), 'a', {
      providerId: 'provider-a', modelId: 'model-a',
    });
    await registry.ensure('session-a');
    const candidate = await registry.prepareSwitch(
      'session-a', platform, config('model-b'),
      { providerId: 'provider-b', modelId: 'model-b' }, 'b',
    );

    expect(() => registry.disposeSwitch(candidate)).not.toThrow();
    expect(candidate.disposed).toBe(true);
    expect(candidateRuntime.abort).toHaveBeenCalledOnce();
    expect(candidateRuntime.reset).toHaveBeenCalledOnce();
  });

  it('does not retry or install a creation deleted while pending', async () => {
    const pending = deferred<SvtonAgentRuntime>();
    const create = vi.fn(() => pending.promise);
    const registry = new ChatRuntimeRegistryService(create);
    registry.configure(makeBrowserPlatform(), config(), 'v1');
    const result = registry.ensure('a');
    registry.delete('a');
    const runtime = fakeRuntime();
    pending.resolve(runtime);
    await expect(result).rejects.toThrow('delete');
    expect(registry.has('a')).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
    expect(runtime.abort).toHaveBeenCalledOnce();
  });

  it('retries a stale slow creation with the newly configured identity', async () => {
    const first = deferred<SvtonAgentRuntime>();
    const oldRuntime = fakeRuntime();
    const newRuntime = fakeRuntime();
    const create = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(newRuntime);
    const registry = new ChatRuntimeRegistryService(create);
    registry.configure(makeBrowserPlatform(), config('same'), undefined);
    const result = registry.ensure('a');
    registry.configure(makeBrowserPlatform(), config('same'), undefined);
    first.resolve(oldRuntime);
    await expect(result).resolves.toBe(newRuntime);
    expect(create).toHaveBeenCalledTimes(2);
    expect(oldRuntime.reset).toHaveBeenCalledOnce();
  });

  it('cancels slow reconfiguration without replacing or resetting the old slot', async () => {
    const oldRuntime = fakeRuntime();
    const replacement = deferred<SvtonAgentRuntime>();
    const create = vi.fn()
      .mockResolvedValueOnce(oldRuntime)
      .mockImplementationOnce(() => replacement.promise);
    const registry = new ChatRuntimeRegistryService(create);
    const platform = makeBrowserPlatform();
    registry.configure(platform, config('same'), undefined);
    await registry.ensure('a');
    registry.configure(platform, config('same'), undefined);
    const result = registry.ensureCurrent('a');
    expect(registry.cancelPending('a')).toBe(true);
    const rejectedRuntime = fakeRuntime();
    replacement.resolve(rejectedRuntime);
    await expect(result).rejects.toThrow('delete');
    expect(registry.get('a')).toBe(oldRuntime);
    expect(oldRuntime.reset).not.toHaveBeenCalled();
    expect(rejectedRuntime.reset).toHaveBeenCalledOnce();
  });

  it('owns one lease per session and interrupts A without mutating B', () => {
    const ownership = new ChatRunOwnershipService();
    const a = ownership.begin({ sessionId: 'a', runId: 'run-a' }, 'assistant-a');
    const b = ownership.begin({ sessionId: 'b', runId: 'run-b' }, 'assistant-b');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(ownership.begin({ sessionId: 'a', runId: 'run-a2' }, 'assistant-a2')).toBeNull();
    ownership.abortSession('a');
    expect(a?.acceptsEvents()).toBe(false);
    expect(b?.acceptsEvents()).toBe(true);
  });
});

describe('runtime config isolation', () => {
  it('clones mutable registries and removes inherited runtime-bound executors', () => {
    const source = config();
    source.capabilities = {
      ...source.capabilities,
      permissionManager: new PermissionManager({
        mode: 'accept_edits', rules: [{ tool: 'plain', effect: 'allow' }],
      }),
    };
    const executor = { execute: vi.fn() };
    source.toolRegistry.register({ name: 'plain', description: '', parameters: {} }, executor as never);
    source.toolRegistry.register({ name: 'subagent_spawn', description: '', parameters: {} }, executor as never);
    const left = cloneRuntimeConfig(source);
    const right = cloneRuntimeConfig(source);
    expect(left.toolRegistry).not.toBe(right.toolRegistry);
    expect(left.toolRegistry.get('plain')?.executor).toBe(executor);
    expect(left.toolRegistry.has('subagent_spawn')).toBe(false);
    expect(right.toolRegistry.has('subagent_spawn')).toBe(false);
    const sourcePermissions = source.capabilities.permissionManager;
    const leftPermissions = left.capabilities?.permissionManager;
    const rightPermissions = right.capabilities?.permissionManager;
    expect(leftPermissions).not.toBe(sourcePermissions);
    expect(rightPermissions).not.toBe(sourcePermissions);
    expect(leftPermissions).not.toBe(rightPermissions);
    expect(leftPermissions?.getMode()).toBe('accept_edits');
    expect(leftPermissions?.check({
      id: 'plain', name: 'plain', arguments: {},
    })).toEqual({ allowed: true, needsApproval: false });
  });

  it('installs the actual runtime-local permission manager into each slot projection', async () => {
    const source = config();
    const manager = new PermissionManager({ mode: 'default' });
    source.capabilities = { ...source.capabilities, permissionManager: manager };
    const registry = new ChatRuntimeRegistryService();
    registry.configure(makeBrowserPlatform(), source, 'permissions');
    const runtimeA = await registry.ensure('a');
    const runtimeB = await registry.ensure('b');

    expect(runtimeA.getPermissionManager()).not.toBe(manager);
    expect(runtimeB.getPermissionManager()).not.toBe(manager);
    expect(runtimeA.getPermissionManager()).not.toBe(runtimeB.getPermissionManager());
    expect(registry.slot('a')?.permissionMode).toBe('default');
    expect(registry.slot('b')?.permissionMode).toBe('default');
  });

  it('binds subagent executors independently for each configured runtime', async () => {
    const source = { ...config(), capabilities: {} };
    const platform = makeBrowserPlatform();
    const left = await createConfiguredRuntime(source, platform, []);
    const right = await createConfiguredRuntime(source, platform, []);
    const leftRegistry = (left as unknown as { toolRegistry: ToolRegistry }).toolRegistry;
    const rightRegistry = (right as unknown as { toolRegistry: ToolRegistry }).toolRegistry;
    expect(leftRegistry).not.toBe(rightRegistry);
    expect(leftRegistry.get('subagent_spawn')?.executor)
      .not.toBe(rightRegistry.get('subagent_spawn')?.executor);
    expect(source.toolRegistry.has('subagent_spawn')).toBe(false);
  });
});
