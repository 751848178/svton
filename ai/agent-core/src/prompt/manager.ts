import type { PromptTemplate, PromptVariable } from './types';
import type { ToolDefinition } from '../provider/types';
import { buildTemplateVariablePattern } from './prompt-template.utils';

/**
 * Manages system prompts and templates.
 * Composes the final system prompt from: base template + tool descriptions + skills + memory.
 */
export class PromptManager {
  private templates = new Map<string, PromptTemplate>();
  private customInstructions: string[] = [];

  /**
   * Register a prompt template.
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * Add custom instructions (from CLAUDE.md, skills, etc.)
   */
  addInstructions(instructions: string): void {
    this.customInstructions.push(instructions);
  }

  /**
   * Clear all custom instructions.
   */
  clearInstructions(): void {
    this.customInstructions = [];
  }

  /**
   * Compose the full system prompt.
   */
  compose(options: {
    tools?: ToolDefinition[];
    baseTemplate?: string;
    skillsSummary?: string;
    memoryNotes?: string;
    workingDir?: string;
    projectName?: string;
  }): string {
    const parts: string[] = [];

    // Base template
    const base = options.baseTemplate || this.getDefaultTemplate();
    parts.push(base);

    // Working directory context
    if (options.workingDir) {
      parts.push(`\n## Environment\n\nCurrent working directory: \`${options.workingDir}\`${options.projectName ? `\nProject: ${options.projectName}` : ''}\n`);
    }

    // Tool descriptions
    if (options.tools && options.tools.length > 0) {
      parts.push('\n## Available Tools\n');
      for (const tool of options.tools) {
        const annotations = tool.annotations
          ? ` (${[
              tool.annotations.readOnlyHint && 'read-only',
              tool.annotations.destructiveHint && 'destructive',
            ].filter(Boolean).join(', ')})`
          : '';
        parts.push(`- **${tool.name}**${annotations}: ${tool.description}`);
      }
    }

    // Skills summary
    if (options.skillsSummary) {
      parts.push('\n## Skills\n');
      parts.push(options.skillsSummary);
    }

    // Memory notes
    if (options.memoryNotes) {
      parts.push('\n## Context\n');
      parts.push(options.memoryNotes);
    }

    // Custom instructions
    if (this.customInstructions.length > 0) {
      parts.push('\n## Additional Instructions\n');
      parts.push(...this.customInstructions);
    }

    return parts.join('\n');
  }

  /**
   * Render a template with variables.
   */
  renderTemplate(name: string, variables: PromptVariable[]): string {
    const template = this.templates.get(name);
    if (!template) throw new Error(`Template "${name}" not found`);

    let result = template.template;
    for (const v of variables) {
      result = result.replace(buildTemplateVariablePattern(v.key), v.value);
    }
    return result;
  }

  private getDefaultTemplate(): string {
    return `You are an intelligent AI assistant. You help users accomplish tasks by reasoning step-by-step and using tools when needed.

## Guidelines

- Think carefully before acting
- Break complex tasks into smaller steps
- Use tools when you need to interact with the system
- Explain your reasoning clearly
- If something fails, diagnose the issue and try an alternative approach

## Plan Management

When a task involves multiple steps, use the planning tools:
1. Use \`plan_create\` to break down complex tasks into ordered steps
2. **CRITICAL**: After completing each step, immediately call \`plan_update_step\` with status "completed" (or "failed"/"skipped") — do NOT wait until all steps are done
3. Use \`plan_get_status\` to check progress if you lose track
4. Every step you complete MUST be reflected in the plan — never leave a step as "pending" after you have done the work

## Memory

You have long-term memory that persists across conversations:
- Use \`memory_save\` to save important facts, user preferences, project context, or anything worth remembering for future conversations
- Use \`memory_recall\` to look up previously saved memories
- Proactively save things like: user preferences, project conventions, important decisions, recurring patterns
- Do NOT save trivial or obvious information`;
  }
}
