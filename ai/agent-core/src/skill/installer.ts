import type { SkillDefinition, SkillSource, SkillInstallRecord } from './types';
import type { IStorage, IPlatform } from '@svton/agent-platform';
import { SkillLoader } from './loader';
import { readGitSkillContent } from './git-skill-content.utils';
import {
  snapshotSkillInstallRecord,
  snapshotSkillInstallRecords,
} from './skill-install-record-snapshot.utils';
import { snapshotSkillDefinition } from './skill-definition-snapshot.utils';
import { snapshotSkillSource } from './skill-source-snapshot.utils';
import { formatUnknownErrorMessage } from '../utils/error-message.utils';

export interface InstallResult {
  success: boolean;
  skill?: SkillDefinition;
  error?: string;
}

/**
 * Skill installation engine.
 *
 * Supports three installation sources:
 * - URL: fetch SKILL.md from HTTP (works on all platforms)
 * - Git: clone repo and extract SKILL.md (desktop only)
 * - Local: read SKILL.md from filesystem (desktop only)
 */
export class SkillInstaller {
  constructor(
    private storage: IStorage,
    private platform?: IPlatform,
  ) {}

  /**
   * Install a skill from a URL (works on web + desktop).
   * The URL should point directly to a SKILL.md file.
   */
  async installFromUrl(url: string): Promise<InstallResult> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        return { success: false, error: `HTTP ${resp.status}: ${resp.statusText}` };
      }
      const content = await resp.text();
      return this.installFromContent(content, { type: 'url', url });
    } catch (err) {
      return { success: false, error: formatUnknownErrorMessage(err) };
    }
  }

  /**
   * Install a skill from a Git repository (desktop only).
   * Uses git archive to fetch SKILL.md without cloning the full repo.
   */
  async installFromGit(repo: string, ref?: string): Promise<InstallResult> {
    const result = await readGitSkillContent(this.platform, repo, ref);
    if (result.error || !result.content) {
      return { success: false, error: result.error ?? 'No SKILL.md found in repository' };
    }
    return this.installFromContent(result.content, { type: 'git', repo, ref });
  }

  /**
   * Install a skill from a local directory (desktop only).
   * Reads SKILL.md from the specified directory.
   */
  async installFromLocalDir(dirPath: string): Promise<InstallResult> {
    if (!this.platform?.fs) {
      return { success: false, error: 'Local installation requires desktop (filesystem access)' };
    }

    try {
      const skillMdPath = this.platform.fs.join(dirPath, 'SKILL.md');
      const exists = await this.platform.fs.exists(skillMdPath);
      if (!exists) {
        return { success: false, error: `SKILL.md not found at ${skillMdPath}` };
      }

      const content = await this.platform.fs.readFile(skillMdPath);
      return this.installFromContent(content, { type: 'local', path: dirPath });
    } catch (err) {
      return { success: false, error: formatUnknownErrorMessage(err) };
    }
  }

  /**
   * Uninstall a previously installed skill.
   */
  async uninstall(name: string): Promise<void> {
    await SkillLoader.removeInstalled(this.storage, name);
    // Also remove registry record
    await this.storage.delete(`agent:skill-registry:${name}`);
  }

  /**
   * List all installed skills with their metadata.
   */
  async listInstalled(): Promise<SkillInstallRecord[]> {
    const keys = await this.storage.list('agent:skill-registry:');
    const records: SkillInstallRecord[] = [];
    for (const key of keys) {
      const record = await this.storage.get<SkillInstallRecord>(key);
      if (record) records.push(record);
    }
    return snapshotSkillInstallRecords(records);
  }

  // ── Internal ──

  private async installFromContent(
    content: string,
    source: SkillSource,
  ): Promise<InstallResult> {
    const skill = SkillLoader.parseMarkdown(content);

    if (!skill.name || skill.name === 'unnamed-skill') {
      return { success: false, error: 'SKILL.md missing required "name" field' };
    }

    const sourceSnapshot = snapshotSkillSource(source);
    const installedSkill = snapshotSkillDefinition({
      ...skill,
      source: sourceSnapshot,
    });

    // Save the skill as installed
    await SkillLoader.saveInstalled(this.storage, installedSkill);

    // Save the install record
    const record = snapshotSkillInstallRecord({
      name: installedSkill.name,
      source: sourceSnapshot,
      installedAt: Date.now(),
      version: installedSkill.version,
    });
    await this.storage.set(`agent:skill-registry:${installedSkill.name}`, record);

    return { success: true, skill: snapshotSkillDefinition(installedSkill) };
  }

}
