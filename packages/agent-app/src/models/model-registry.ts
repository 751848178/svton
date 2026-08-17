import {
  decodeModelKey,
  encodeModelKey,
  type ModelKey,
} from '@svton/agent-client';
import type { ProviderConfig } from '../types';

const RETIRED_MODEL_LIMIT = 64;

export interface RegistryModelSource {
  id: string;
  name: string;
  hidden?: boolean;
  reasoningEfforts?: string[];
  defaultReasoningEffort?: string;
  inputModalities?: string[];
  serviceTiers?: string[];
}

export interface RegistryProviderSource {
  id: string;
  name: string;
  type: string;
  source?: 'configured' | 'bootstrap';
  models: readonly RegistryModelSource[];
}

export interface ModelRegistryRecord {
  key: ModelKey;
  value: string;
  displayName: string;
  providerName: string;
  providerType: string;
  source: 'configured' | 'bootstrap';
  hidden: boolean;
  reasoningEfforts: readonly string[];
  defaultReasoningEffort?: string;
  inputModalities: readonly string[];
  serviceTiers: readonly string[];
  removed: boolean;
}

export interface ModelRegistrySnapshot {
  revision: number;
  records: readonly ModelRegistryRecord[];
}

export class LiveModelRegistry {
  private revision = 0;
  private records: readonly ModelRegistryRecord[] = [];
  private snapshot: ModelRegistrySnapshot = Object.freeze({
    revision: 0,
    records: Object.freeze([]),
  });
  private readonly listeners = new Set<() => void>();
  private readonly retired = new Map<string, ModelRegistryRecord>();

  constructor(sources: readonly RegistryProviderSource[]) {
    this.replace(sources);
  }

  getSnapshot = (): ModelRegistrySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  replace(sources: readonly RegistryProviderSource[]): void {
    const previous = this.records;
    this.records = Object.freeze(sources.flatMap((provider) =>
      provider.models.map((model): ModelRegistryRecord => Object.freeze({
        key: Object.freeze({ providerId: provider.id, modelId: model.id }),
        value: encodeModelKey({ providerId: provider.id, modelId: model.id }),
        displayName: model.name || model.id,
        providerName: provider.name || provider.id,
        providerType: provider.type,
        source: provider.source ?? 'configured',
        hidden: model.hidden === true,
        reasoningEfforts: Object.freeze([...(model.reasoningEfforts ?? [])]),
        defaultReasoningEffort: model.defaultReasoningEffort,
        inputModalities: Object.freeze([...(model.inputModalities ?? [])]),
        serviceTiers: Object.freeze([...(model.serviceTiers ?? [])]),
        removed: false,
      })),
    ));
    const currentValues = new Set(this.records.map((record) => record.value));
    for (const record of previous) {
      if (!currentValues.has(record.value)) {
        this.retired.delete(record.value);
        this.retired.set(record.value, Object.freeze({ ...record, removed: true }));
      }
    }
    for (const value of currentValues) this.retired.delete(value);
    while (this.retired.size > RETIRED_MODEL_LIMIT) {
      const oldest = this.retired.keys().next().value;
      if (oldest === undefined) break;
      this.retired.delete(oldest);
    }
    this.snapshot = Object.freeze({
      revision: ++this.revision,
      records: this.records,
    });
    for (const listener of this.listeners) listener();
  }

  resolve(value: string | null | undefined): ModelKey | null {
    const structured = decodeModelKey(value);
    if (structured && this.find(structured)) return structured;
    if (!value) return null;
    const legacy = this.records.filter((record) =>
      `${record.key.providerId}::${record.key.modelId}` === value);
    if (legacy.length === 1) return legacy[0].key;
    const bare = this.records.filter((record) => record.key.modelId === value);
    return bare.length === 1 ? bare[0].key : null;
  }

  find(key: ModelKey | null): ModelRegistryRecord | null {
    if (!key) return null;
    return this.records.find((record) =>
      record.key.providerId === key.providerId && record.key.modelId === key.modelId) ?? null;
  }

  selectable(current: ModelKey | null): readonly ModelRegistryRecord[] {
    const selectable = this.records.filter((record) =>
      !record.hidden
      || (record.key.providerId === current?.providerId
        && record.key.modelId === current.modelId));
    if (!current || this.find(current)) return selectable;
    return [...selectable, this.removedRecord(current)];
  }

  display(current: ModelKey): ModelRegistryRecord {
    return this.find(current) ?? this.removedRecord(current);
  }

  private removedRecord(current: ModelKey): ModelRegistryRecord {
    const value = encodeModelKey(current);
    return this.retired.get(value) ?? Object.freeze({
      key: Object.freeze({ ...current }),
      value,
      displayName: current.modelId,
      providerName: current.providerId,
      providerType: 'removed',
      source: 'configured',
      hidden: false,
      removed: true,
      reasoningEfforts: Object.freeze([]),
      inputModalities: Object.freeze([]),
      serviceTiers: Object.freeze([]),
    });
  }
}

export function providerConfigsToRegistrySources(
  providers: readonly ProviderConfig[],
): RegistryProviderSource[] {
  return providers.map((provider) => ({
    id: provider.name || provider.type,
    name: provider.name || provider.type,
    type: provider.type,
    models: provider.models,
  }));
}
