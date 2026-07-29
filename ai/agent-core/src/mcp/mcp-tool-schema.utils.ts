import type { SvtonToolParameters } from '../tool/types';

/** Clone a complete MCP/TypeBox schema without narrowing JSON Schema keywords. */
export function cloneMcpToolSchema(
  schema: SvtonToolParameters,
): SvtonToolParameters {
  return structuredClone(schema);
}
