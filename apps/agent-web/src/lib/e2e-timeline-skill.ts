import {
  SkillLoader,
  type SkillDefinition,
} from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import { E2E_TIMELINE_SKILL_TRIGGER } from './e2e-constants';

const E2E_TIMELINE_SKILL: SkillDefinition = {
  name: 'e2e-timeline-context',
  description: 'Deterministic installed-skill fixture for timeline reload E2E.',
  instructions: 'Use the deterministic e2e_command fixture requested by the user.',
  scope: 'user',
  trigger: { type: 'implicit', patterns: [E2E_TIMELINE_SKILL_TRIGGER] },
  triggerSignals: [E2E_TIMELINE_SKILL_TRIGGER],
  source: { type: 'storage' },
};

/** Persist through the real installed-skill loader before E2E config discovery. */
export async function installE2eTimelineSkill(platform: BrowserPlatform): Promise<void> {
  await SkillLoader.saveInstalled(platform.storage, E2E_TIMELINE_SKILL);
}
