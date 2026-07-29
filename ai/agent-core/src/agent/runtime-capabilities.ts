/**
 * Runtime capability wiring — system-prompt composition, skill-context
 * injection, and MCP tool bridging.
 *
 * Extracted from `svton-agent-runtime.ts` to keep the composition root under
 * the 200-line ceiling (code-structure-standards). These methods prepare the
 * Pi Agent's system prompt + tool registry + transcript before each run; they
 * do not participate in the ReAct loop (Pi owns that).
 */
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { MCPClient } from '../mcp/client';
import type { ToolRegistry } from '../tool/registry';
import type { PermissionManager } from '../permission/manager';
import type { SkillManager } from '../skill/manager';
import type { SkillDefinition } from '../skill/types';
import type { MemoryManager } from '../memory/manager';
import type { PromptManager } from '../prompt/manager';
import type { IPlatform } from '@svton/agent-platform';
import type { ContentBlock, McpServerToolConfig } from './types';
import { createToolExecOptions } from './tool-exec-options.utils';
import { resolveSkillDynamicContext } from './skill-dynamic-context.utils';

/** Inputs shared with the runtime for capability preparation. */
export interface CapabilityContext {
  platform: IPlatform;
  workingDir: string;
  toolRegistry: ToolRegistry;
  promptManager: PromptManager | null;
  skillManager: SkillManager | null;
  memoryManager: MemoryManager | null;
  permissionManager: PermissionManager | null;
  mcpClients: MCPClient[];
  mcpServerConfigs: Map<string, McpServerToolConfig>;
}

/** Activated-skill + injected-context result of `injectSkillContext`. */
export interface SkillInjection {
  skills: SkillDefinition[];
  contextMessage: AgentMessage | null;
}

/**
 * Compose the system prompt from prompt/skill/memory summaries, or fall back
 * to a default tool-listing prompt when no PromptManager is configured.
 */
export function composeSystemPrompt(ctx: CapabilityContext): string {
  if (ctx.promptManager) {
    return ctx.promptManager.compose({
      tools: ctx.toolRegistry.listDefinitions(),
      skillsSummary: ctx.skillManager?.getSummaries() || undefined,
      memoryNotes: ctx.memoryManager?.getAllMemoryText() || undefined,
      workingDir: ctx.workingDir || undefined,
    });
  }
  return buildDefaultSystemPrompt(ctx);
}

/** Default system prompt enumerating available tools. */
export function buildDefaultSystemPrompt(ctx: CapabilityContext): string {
  const toolNames = ctx.toolRegistry
    .listDefinitions()
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');
  return `You are an intelligent AI assistant with access to the following tools:\n\n${toolNames}\n\nWhen you need to use a tool, invoke it with the appropriate parameters. Think step by step and explain your reasoning before taking actions. If a task requires multiple steps, break it down and use tools as needed.`;
}

/**
 * Match the user message against registered skills and inject the relevant
 * skill instructions into the transcript. Returns the names of activated
 * skills (for the `skill_activated` event). Caller appends the returned
 * context message to the Pi transcript.
 */
export async function injectSkillContext(
  ctx: CapabilityContext,
  userMessage: string,
  autoReviewer: unknown,
  resumeManager: unknown,
): Promise<SkillInjection> {
  if (!ctx.skillManager) return { skills: [], contextMessage: null };
  const relevant = ctx.skillManager.findRelevant(userMessage);
  if (relevant.length === 0) return { skills: [], contextMessage: null };

  const availableTools = ctx.toolRegistry.listDefinitions().map((t) => t.name);
  const usable = relevant.filter((s) => ctx.skillManager!.isSkillAvailable(s, availableTools));
  if (usable.length === 0) return { skills: [], contextMessage: null };
  const skillManager = ctx.skillManager;

  const allToolNames = ctx.toolRegistry.listDefinitions().map((t) => t.name);
  const execOptions = createToolExecOptions({
    platform: ctx.platform,
    workingDir: ctx.workingDir,
    autoReviewer: autoReviewer as never,
    resumeManager: resumeManager as never,
  });
  const blocks: string[] = [];
  for (const s of usable) {
    let instructions = skillManager.loadInstructions(s.name) ?? s.description;
    if (ctx.platform.capabilities.process) {
      instructions = await resolveSkillDynamicContext(instructions, {
        platform: ctx.platform,
        workingDir: ctx.workingDir,
        sandboxProfile: execOptions.sandboxProfile,
        sandboxRequired: execOptions.sandboxRequired,
      });
    }
    let block = `### Skill: ${s.name}\n${instructions}`;
    const effective = skillManager.getEffectiveTools(s, allToolNames);
    if (effective) block += `\n\n**Tools available for this skill:** ${effective.join(', ')}`;
    blocks.push(block);
  }
  const contextMessage: AgentMessage = {
    role: 'user',
    content: `[Skill Context Activated]\nThe following skills are relevant to your request:\n\n${blocks.join('\n\n')}`,
    timestamp: Date.now(),
  } as AgentMessage;
  return { skills: usable, contextMessage };
}

/**
 * Bridge discovered MCP tools into the svton ToolRegistry, applying per-server
 * approval/enabled/disabled policy. Mirrors the legacy runtime.initialize()
 * path; runs once during createAsync.
 */
export async function bridgeMcpTools(ctx: CapabilityContext): Promise<void> {
  for (const client of ctx.mcpClients) {
    if (!client.connected) continue;
    try {
      await bridgeOneMcpClient(ctx, client);
    } catch (error) {
      console.error(`Failed to bridge MCP tools from ${client.info?.name ?? 'unknown'}:`, error);
    }
  }
}

async function bridgeOneMcpClient(ctx: CapabilityContext, client: MCPClient): Promise<void> {
  const serverName = client.info?.name ?? '';
  const serverConfig = serverName ? ctx.mcpServerConfigs.get(serverName) : undefined;
  const mcpTools = await client.listTools();
  const toolDefs = client.toToolDefinitions(mcpTools);
  for (const def of toolDefs) {
    const namespacedName = def.name.startsWith('mcp__') ? def.name : `mcp__${def.name}`;
    const originalName = namespacedName.split('__').pop()!;
    if (serverConfig) {
      if (serverConfig.approvalMode === 'deny') continue;
      if (serverConfig.enabledTools?.length && !serverConfig.enabledTools.includes(originalName)) continue;
      if (serverConfig.disabledTools?.includes(originalName)) continue;
    }
    const executor = client.createToolExecutor(originalName);
    ctx.toolRegistry.register({ ...def, name: namespacedName }, executor);
    if (serverConfig?.approvalMode === 'auto' && ctx.permissionManager) {
      ctx.permissionManager.addRule({ tool: def.name, effect: 'allow' });
    }
  }
}

/** Build the AgentMessage[] to feed Pi for a run (user msg). */
export function buildPromptMessages(userMessage: string | ContentBlock[]): AgentMessage[] {
  if (typeof userMessage === 'string') {
    return [{ role: 'user', content: userMessage, timestamp: Date.now() }] as AgentMessage[];
  }
  const content = userMessage.map((b) => b.type === 'image'
    ? { type: 'image' as const, data: b.data, mimeType: b.mimeType ?? 'image/png' }
    : { type: 'text' as const, text: b.type === 'text' ? b.text : '' });
  return [{ role: 'user', content, timestamp: Date.now() }] as AgentMessage[];
}
