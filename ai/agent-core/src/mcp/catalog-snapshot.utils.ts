import type { SvtonToolDefinition } from '../tool/types';
import type { MCPPrompt, MCPResource, MCPToolDefinition } from './types';
import { cloneMcpToolSchema } from './mcp-tool-schema.utils';

function cloneMcpTool(tool: MCPToolDefinition): MCPToolDefinition {
  return {
    ...tool,
    inputSchema: cloneMcpToolSchema(tool.inputSchema),
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
): SvtonToolDefinition[] {
  return tools.map((tool) => {
    const inputSchema = cloneMcpTool(tool).inputSchema;
    return {
      name: `mcp__${serverName || 'unknown'}__${tool.name}`,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: inputSchema,
      annotations: {
        openWorldHint: true,
      },
      metadata: {
        source: 'mcp',
        sourceId: serverName,
      },
    };
  });
}
