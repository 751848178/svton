import type { ToolDefinition } from '../provider/types';
import type { MCPPrompt, MCPResource, MCPToolDefinition } from './types';

function cloneUnknownValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneUnknownValue);
  if (!value || typeof value !== 'object') return value;

  const clone: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = cloneUnknownValue(entry);
  }
  return clone;
}

function cloneMcpTool(tool: MCPToolDefinition): MCPToolDefinition {
  return {
    ...tool,
    inputSchema: {
      type: 'object',
      properties: cloneUnknownValue(tool.inputSchema.properties ?? {}) as Record<string, unknown>,
      required: tool.inputSchema.required ? [...tool.inputSchema.required] : undefined,
    },
  };
}

export function cloneMcpTools(tools: MCPToolDefinition[]): MCPToolDefinition[] {
  return tools.map(cloneMcpTool);
}

export function cloneMcpResources(resources: MCPResource[]): MCPResource[] {
  return resources.map((resource) => ({ ...resource }));
}

export function cloneMcpPrompts(prompts: MCPPrompt[]): MCPPrompt[] {
  return prompts.map((prompt) => ({
    ...prompt,
    arguments: prompt.arguments?.map((argument) => ({ ...argument })),
  }));
}

export function toToolDefinitions(
  tools: MCPToolDefinition[],
  serverName: string | undefined,
): ToolDefinition[] {
  return tools.map((tool) => {
    const inputSchema = cloneMcpTool(tool).inputSchema;
    return {
      name: `mcp__${serverName || 'unknown'}__${tool.name}`,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: {
        type: 'object',
        properties: inputSchema.properties ?? {},
        required: inputSchema.required,
      },
      annotations: {
        openWorldHint: true,
      },
    };
  });
}
