import type { SkillDefinition } from '../skill/types';
import type { ToolCall, ToolResult } from '../tool/types';

export function enforceActiveSkillToolGate(
  call: ToolCall,
  activeSkills: SkillDefinition[],
): ToolResult | null {
  for (const skill of activeSkills) {
    if (skill.disallowedTools?.includes(call.name)) {
      return {
        callId: call.id,
        output: `Tool "${call.name}" is disallowed by active skill "${skill.name}"`,
        isError: true,
      };
    }
    if (skill.allowedTools?.length && !skill.allowedTools.includes(call.name)) {
      return {
        callId: call.id,
        output: `Tool "${call.name}" is not in the allowed list for active skill "${skill.name}"`,
        isError: true,
      };
    }
  }
  return null;
}
