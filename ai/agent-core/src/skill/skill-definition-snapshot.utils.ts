import type { SkillDefinition } from './types';
import { snapshotSkillSource } from './skill-source-snapshot.utils';

export function snapshotSkillDefinition(skill: SkillDefinition): SkillDefinition {
  const snapshot: SkillDefinition = { ...skill };

  if (skill.trigger) {
    snapshot.trigger = { ...skill.trigger };
    if (skill.trigger.patterns) snapshot.trigger.patterns = [...skill.trigger.patterns];
  }
  if (skill.requiredTools) snapshot.requiredTools = [...skill.requiredTools];
  if (skill.requiredCapabilities) {
    snapshot.requiredCapabilities = [...skill.requiredCapabilities];
  }
  if (skill.allowedTools) snapshot.allowedTools = [...skill.allowedTools];
  if (skill.disallowedTools) snapshot.disallowedTools = [...skill.disallowedTools];
  if (skill.whenToUse) snapshot.whenToUse = [...skill.whenToUse];
  if (skill.avoidWhen) snapshot.avoidWhen = [...skill.avoidWhen];
  if (skill.triggerSignals) snapshot.triggerSignals = [...skill.triggerSignals];
  if (skill.source) snapshot.source = snapshotSkillSource(skill.source);

  return snapshot;
}

export function snapshotSkillDefinitions(
  skills: Iterable<SkillDefinition>,
): SkillDefinition[] {
  return Array.from(skills, snapshotSkillDefinition);
}
