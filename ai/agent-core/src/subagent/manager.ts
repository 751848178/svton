import type { IPlatform } from '@svton/agent-platform';
import type { ChatMessage, TokenUsage } from '../provider/types';
import type { AgentConfig, IRuntime } from '../agent/types';
import type { SubagentConfig, SubagentResult } from './types';
import { ToolRegistry } from '../tool/registry';

let subagentCounter = 0;

/**
 * Manages subagents - isolated Agent instances that handle delegated tasks.
 *
 * Key principles:
 * - Each subagent has its own context window (isolated from parent)
 * - Only a summary returns to the parent (not full conversation)
 * - Subagents can have restricted tool sets
 * - Subagents can run in parallel
 */
export class SubagentManager {
  private readonly parentConfig: AgentConfig;
  private readonly parentRuntime: IRuntime;
  private readonly platform: IPlatform;
  private readonly toolRegistry: ToolRegistry;

  constructor(
    parentConfig: AgentConfig,
    parentRuntime: IRuntime,
    platform: IPlatform,
    toolRegistry: ToolRegistry,
  ) {
    this.parentConfig = parentConfig;
    this.parentRuntime = parentRuntime;
    this.platform = platform;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Spawn a single subagent to handle a task.
   */
  async spawn(config: SubagentConfig): Promise<SubagentResult> {
    const agentId = `subagent_${++subagentCounter}_${Date.now()}`;

    try {
      const subRegistry = this.buildToolRegistry(config);
      const subConfig = this.buildConfig(config, subRegistry);

      const runtime = this.createRuntime(subConfig, config);
      const { messages, usage } = await this.runSubagent(runtime, config.task);

      const summary = await this.summarize(messages);

      return {
        agentId,
        summary,
        messages,
        usage,
        success: true,
      };
    } catch (error) {
      return {
        agentId,
        summary: `Subagent failed: ${error instanceof Error ? error.message : String(error)}`,
        messages: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Spawn multiple subagents in parallel.
   */
  async spawnParallel(configs: SubagentConfig[]): Promise<SubagentResult[]> {
    return Promise.all(configs.map((config) => this.spawn(config)));
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private buildToolRegistry(config: SubagentConfig): ToolRegistry {
    const registry = new ToolRegistry();

    // Copy tools from parent, applying allowlist/denylist
    const allDefs = this.toolRegistry.listDefinitions();

    for (const def of allDefs) {
      // Check denylist
      if (config.excludeTools?.includes(def.name)) continue;

      // Check allowlist (if specified, only include listed tools)
      if (config.tools && !config.tools.includes(def.name)) continue;

      const entry = this.toolRegistry.get(def.name);
      if (entry) {
        registry.register(entry.definition, entry.executor);
      }
    }

    return registry;
  }

  private buildConfig(config: SubagentConfig, registry: ToolRegistry): AgentConfig {
    // Propagate parent capabilities, excluding subagentManager to prevent infinite nesting
    const subCapabilities = this.parentConfig.capabilities
      ? { ...this.parentConfig.capabilities, subagentManager: undefined }
      : undefined;

    return {
      provider: this.parentConfig.provider,
      model: config.model || this.parentConfig.model,
      toolRegistry: registry,
      systemPrompt: this.buildSubagentPrompt(config),
      maxIterations: config.maxIterations || 20,
      workingDir: this.parentConfig.workingDir,
      contextConfig: this.parentConfig.contextConfig,
      capabilities: subCapabilities,
    };
  }

  private buildSubagentPrompt(config: SubagentConfig): string {
    const role = config.roleDescription || 'a specialized AI assistant';

    return `You are ${role}, working as a subagent.

## Your Task
${config.task}

## Guidelines
- Focus only on the assigned task
- Be concise and efficient
- When done, provide a clear summary of what you accomplished
- If you cannot complete the task, explain why`;
  }

  private createRuntime(config: AgentConfig, _subConfig: SubagentConfig): IRuntime {
    // Import dynamically to avoid circular dependency at module level
    // but use proper async-compatible import pattern
    const { AgentRuntime } = require('../agent/runtime') as typeof import('../agent/runtime');
    return AgentRuntime.create(config, this.platform);
  }

  private async runSubagent(
    runtime: IRuntime,
    task: string,
  ): Promise<{ messages: ChatMessage[]; usage: TokenUsage }> {
    const messages: ChatMessage[] = [];
    let finalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const timeoutMs = 120000; // 2 minutes default
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let assistantText = '';

      for await (const event of runtime.run(task, { signal: controller.signal })) {
        switch (event.type) {
          case 'text_delta':
            assistantText += event.text;
            break;
          case 'done':
            finalUsage = event.usage;
            break;
        }
      }

      if (assistantText) {
        messages.push({ role: 'assistant', content: assistantText });
      }
    } finally {
      clearTimeout(timer);
    }

    // Also get the full conversation from the runtime
    const fullMessages = runtime.getMessages();

    return {
      messages: fullMessages.length > 0 ? fullMessages : messages,
      usage: finalUsage,
    };
  }

  /**
   * Generate a concise summary of the subagent's work.
   * Uses LLM for summarization when provider is available,
   * falls back to extracting the last assistant message.
   */
  private async summarize(messages: ChatMessage[]): Promise<string> {
    const assistantText = this.extractLastAssistantText(messages);
    if (!assistantText) return 'Subagent completed the task.';

    // Try LLM summarization
    try {
      const summary = await this.summarizeWithLLM(assistantText);
      if (summary) return summary;
    } catch {
      // Fall through to simple extraction
    }

    // Fallback: truncate last assistant message
    if (assistantText.length > 2000) {
      return assistantText.slice(0, 2000) + '...';
    }
    return assistantText;
  }

  private extractLastAssistantText(messages: ChatMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      if (typeof msg.content === 'string' && msg.content.trim()) {
        return msg.content.trim();
      }
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text);
        if (textParts.length > 0) return textParts.join('\n').trim();
      }
    }
    return '';
  }

  private async summarizeWithLLM(text: string): Promise<string | null> {
    const provider = this.parentConfig.provider;
    const model = this.parentConfig.model;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Summarize the following subagent output in 3-5 concise sentences. Focus on what was accomplished and any key findings:\n\n${text.slice(0, 8000)}`,
      },
    ];

    const options = {
      model,
      stream: false,
    };

    let result = '';
    for await (const event of provider.chat(messages, options as any)) {
      if (event.type === 'text_delta') {
        result += event.text;
      }
    }

    return result.trim() || null;
  }
}
