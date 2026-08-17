import { describe, expect, it, vi } from 'vitest';
import { encodeModelKey } from '@svton/agent-client';
import { LiveModelRegistry } from '../src/models/model-registry';

const sources = [
  {
    id: 'provider::a',
    name: 'Provider A',
    type: 'openai',
    models: [
      { id: 'shared', name: 'Shared A', reasoningEfforts: ['low'] },
      { id: 'model::edge', name: 'Edge A', hidden: true },
    ],
  },
  {
    id: 'provider-b',
    name: 'Provider B',
    type: 'anthropic',
    models: [{ id: 'shared', name: 'Shared B' }],
  },
] as const;

describe('LiveModelRegistry', () => {
  it('uses lossless provider-qualified identity for duplicate and delimiter IDs', () => {
    const registry = new LiveModelRegistry(sources);
    const edge = { providerId: 'provider::a', modelId: 'model::edge' };
    expect(registry.resolve(encodeModelKey(edge))).toEqual(edge);
    expect(registry.resolve('shared')).toBeNull();
    expect(registry.resolve('provider-b::shared')).toEqual({
      providerId: 'provider-b',
      modelId: 'shared',
    });
  });

  it('keeps a hidden current model as an honest non-selectable recovery row', () => {
    const registry = new LiveModelRegistry(sources);
    const current = { providerId: 'provider::a', modelId: 'model::edge' };
    expect(registry.selectable(null).map((record) => record.displayName))
      .toEqual(['Shared A', 'Shared B']);
    const records = registry.selectable(current);
    expect(records.find((record) => record.displayName === 'Edge A')?.hidden).toBe(true);
  });

  it('publishes one synchronized snapshot for capability and provider edits', () => {
    const registry = new LiveModelRegistry(sources);
    const listener = vi.fn();
    registry.subscribe(listener);
    registry.replace([{
      id: 'provider-b',
      name: 'Provider B updated',
      type: 'anthropic',
      models: [{
        id: 'shared',
        name: 'Shared B updated',
        reasoningEfforts: ['medium', 'high'],
        defaultReasoningEffort: 'high',
      }],
    }]);
    expect(listener).toHaveBeenCalledOnce();
    const record = registry.getSnapshot().records[0];
    expect(record.providerName).toBe('Provider B updated');
    expect(record.reasoningEfforts).toEqual(['medium', 'high']);
    expect(record.defaultReasoningEffort).toBe('high');
  });

  it('preserves the exact removed active provider without falling to a duplicate', () => {
    const registry = new LiveModelRegistry(sources);
    const active = { providerId: 'provider::a', modelId: 'shared' };
    registry.replace([sources[1]]);

    const options = registry.selectable(active);
    const orphan = options.find((record) => record.key.providerId === 'provider::a');
    expect(orphan).toMatchObject({
      displayName: 'Shared A',
      providerName: 'Provider A',
      removed: true,
    });
    expect(options.find((record) => record.key.providerId === 'provider-b')?.removed).toBe(false);
    expect(registry.display(active)).toBe(orphan);
    expect(registry.resolve(encodeModelKey(active))).toBeNull();
  });

  it('synthesizes an honest removed label when no prior record exists', () => {
    const registry = new LiveModelRegistry(sources);
    const unknown = { providerId: 'removed-provider', modelId: 'removed-model' };
    expect(registry.display(unknown)).toMatchObject({
      providerName: 'removed-provider',
      displayName: 'removed-model',
      removed: true,
    });
  });

  it('bounds retired label history while preserving honest orphan identity', () => {
    const registry = new LiveModelRegistry([]);
    for (let index = 0; index < 80; index += 1) {
      registry.replace([{
        id: `provider-${index}`, name: `Known ${index}`, type: 'openai',
        models: [{ id: `model-${index}`, name: `Known Model ${index}` }],
      }]);
    }
    registry.replace([]);
    const retired = (registry as unknown as { retired: Map<string, unknown> }).retired;
    expect(retired.size).toBeLessThanOrEqual(64);
    expect(registry.display({ providerId: 'provider-0', modelId: 'model-0' })).toMatchObject({
      providerName: 'provider-0', displayName: 'model-0', removed: true,
    });
  });
});
