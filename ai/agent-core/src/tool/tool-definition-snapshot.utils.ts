import type { ToolDefinition } from '../provider/types';

function cloneSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneSchemaValue);
  if (!value || typeof value !== 'object') return value;

  const clone: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = cloneSchemaValue(entry);
  }
  return clone;
}

export function cloneToolDefinition(definition: ToolDefinition): ToolDefinition {
  return {
    ...definition,
    parameters: cloneSchemaValue(definition.parameters) as ToolDefinition['parameters'],
    annotations: definition.annotations ? { ...definition.annotations } : undefined,
  };
}
