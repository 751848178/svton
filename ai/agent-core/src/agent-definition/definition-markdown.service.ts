import type { AgentDefinition, AgentDefinitionSource } from './types';

function parseList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

/**
 * Parse an agent definition from markdown with YAML-like frontmatter.
 * Format:
 * ---
 * name: my-agent
 * title: My Agent
 * description: Does things
 * model: deepseek-chat
 * tools: file_read, grep, glob
 * icon: bug
 * ---
 * System prompt body here...
 */
export function parseAgentMarkdown(
  content: string,
  source: AgentDefinitionSource,
): AgentDefinition | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();
  const def: Partial<AgentDefinition> = { source };

  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    switch (key) {
      case 'name': def.name = value; break;
      case 'title': def.title = value; break;
      case 'description': def.description = value; break;
      case 'model': def.model = value; break;
      case 'tools': def.tools = parseList(value); break;
      case 'excludeTools': def.excludeTools = parseList(value); break;
      case 'icon': def.icon = value; break;
      case 'color': def.color = value; break;
      case 'permissions': def.permissions = value as AgentDefinition['permissions']; break;
      case 'skills': def.skills = parseList(value); break;
    }
  }

  if (!def.name || !def.title) return null;
  def.description = def.description || '';
  def.systemPrompt = body || undefined;

  return def as AgentDefinition;
}
