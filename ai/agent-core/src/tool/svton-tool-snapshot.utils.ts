import type { SvtonToolDefinition } from './types';

export function cloneToolDefinition(definition: SvtonToolDefinition): SvtonToolDefinition {
  return {
    ...definition,
    parameters: structuredClone(definition.parameters),
    annotations: definition.annotations ? { ...definition.annotations } : undefined,
    metadata: definition.metadata ? { ...definition.metadata } : undefined,
  };
}
