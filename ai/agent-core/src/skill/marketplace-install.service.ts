import type { IStorage } from '@svton/agent-platform';
import { formatUnknownErrorMessage } from '../utils/error-message.utils';
import { SkillLoader } from './loader';
import type { InstallResult } from './installer';
import type { RemoteSkillDetail } from './marketplace.types';
import type { SkillInstallRecord } from './types';

const MARKETPLACE_SOURCE_URL = 'https://skills.sh';

interface InstallMarketplaceSkillOptions {
  skillId: string;
  storage: IStorage;
  getDetail: (skillId: string) => Promise<RemoteSkillDetail>;
}

/**
 * Install a skill from marketplace detail data into IStorage.
 *
 * Flow: getDetail -> extract SKILL.md -> parseMarkdown -> save
 */
export async function installMarketplaceSkill(
  options: InstallMarketplaceSkillOptions,
): Promise<InstallResult> {
  const { skillId, storage, getDetail } = options;

  try {
    const detail = await getDetail(skillId);

    if (!detail.files || detail.files.length === 0) {
      return { success: false, error: 'Skill has no downloadable files' };
    }

    const skillFile = detail.files.find((f) => f.path === 'SKILL.md');
    if (!skillFile) {
      return { success: false, error: 'SKILL.md not found in skill files' };
    }

    const skill = SkillLoader.parseMarkdown(skillFile.contents);
    if (!skill.name || skill.name === 'unnamed-skill') {
      return { success: false, error: 'SKILL.md missing required "name" field' };
    }

    skill.source = {
      type: 'url',
      url: `${MARKETPLACE_SOURCE_URL}/${skillId}`,
    };

    await SkillLoader.saveInstalled(storage, skill);

    const record: SkillInstallRecord = {
      name: skill.name,
      source: skill.source,
      installedAt: Date.now(),
      version: skill.version,
    };
    await storage.set(`agent:skill-registry:${skill.name}`, record);

    return { success: true, skill };
  } catch (err) {
    return { success: false, error: formatUnknownErrorMessage(err) };
  }
}
