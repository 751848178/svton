import type { SkillSource } from './types';

export function snapshotSkillSource(source: SkillSource): SkillSource {
  return { ...source };
}
