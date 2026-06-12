import type { SkillDefinition, SkillSource, SkillInstallRecord } from './types';
import type { IStorage, IPlatform } from '@svton/agent-platform';
import { SkillLoader } from './loader';

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
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Install a skill from a Git repository (desktop only).
   * Uses git archive to fetch SKILL.md without cloning the full repo.
   */
  async installFromGit(repo: string, ref?: string): Promise<InstallResult> {
    if (!this.platform?.process) {
      return { success: false, error: 'Git installation requires desktop (process access)' };
    }

    try {
      // Try git archive to fetch SKILL.md directly
      const archiveRef = ref || 'HEAD';
      const { stdout, exitCode } = await this.platform.process.exec(
        `git archive --remote=${repo} ${archiveRef} SKILL.md 2>/dev/null | tar -xO`,
        { timeout: 30000 },
      );

      if (exitCode !== 0 || !stdout.trim()) {
        // Fallback: try .svton/skills/*/SKILL.md patterns
        return await this.installFromGitFallback(repo, ref);
      }

      return this.installFromContent(stdout, { type: 'git', repo, ref });
    } catch (err: any) {
      // Try fallback
      try {
        return await this.installFromGitFallback(repo, ref);
      } catch {
        return { success: false, error: err.message || String(err) };
      }
    }
  }

  /**
   * Fallback for Git: clone to temp dir and search for SKILL.md files.
   */
  private async installFromGitFallback(repo: string, ref?: string): Promise<InstallResult> {
    if (!this.platform?.process || !this.platform?.fs) {
      return { success: false, error: 'Git installation requires desktop' };
    }

    const tmpDir = `/tmp/svton-skill-${Date.now()}`;
    try {
      // Shallow clone
      const cloneCmd = ref
        ? `git clone --depth 1 --branch ${ref} ${repo} ${tmpDir}`
        : `git clone --depth 1 ${repo} ${tmpDir}`;

      const { exitCode } = await this.platform.process.exec(cloneCmd, { timeout: 60000 });
      if (exitCode !== 0) {
        return { success: false, error: `git clone failed (exit code ${exitCode})` };
      }

      // Search for SKILL.md
      const skillContent = await this.findSkillMdInDir(tmpDir);
      if (!skillContent) {
        return { success: false, error: 'No SKILL.md found in repository' };
      }

      return this.installFromContent(skillContent, { type: 'git', repo, ref });
    } finally {
      // Cleanup
      try {
        await this.platform.process.exec(`rm -rf ${tmpDir}`, { timeout: 5000 });
      } catch {
        // Ignore cleanup errors
      }
    }
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
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
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
    return records;
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

    skill.source = source;

    // Save the skill as installed
    await SkillLoader.saveInstalled(this.storage, skill);

    // Save the install record
    const record: SkillInstallRecord = {
      name: skill.name,
      source,
      installedAt: Date.now(),
      version: skill.version,
    };
    await this.storage.set(`agent:skill-registry:${skill.name}`, record);

    return { success: true, skill };
  }

  /**
   * Search for SKILL.md in a directory tree (first level + .svton/skills/).
   */
  private async findSkillMdInDir(dir: string): Promise<string | null> {
    if (!this.platform?.fs) return null;

    // Try root SKILL.md
    try {
      const rootPath = this.platform.fs.join(dir, 'SKILL.md');
      if (await this.platform.fs.exists(rootPath)) {
        return await this.platform.fs.readFile(rootPath);
      }
    } catch { /* skip */ }

    // Try .svton/skills/*/SKILL.md
    try {
      const skillsDir = this.platform.fs.join(dir, '.svton', 'skills');
      if (await this.platform.fs.exists(skillsDir)) {
        const entries = await this.platform.fs.listDir(skillsDir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            try {
              const path = this.platform.fs!.join(skillsDir, entry.name, 'SKILL.md');
              return await this.platform.fs!.readFile(path);
            } catch { /* skip */ }
          }
        }
      }
    } catch { /* skip */ }

    // Try .claude/skills/*/SKILL.md (Claude Code compatibility)
    try {
      const claudeDir = this.platform.fs.join(dir, '.claude', 'skills');
      if (await this.platform.fs.exists(claudeDir)) {
        const entries = await this.platform.fs.listDir(claudeDir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            try {
              const path = this.platform.fs!.join(claudeDir, entry.name, 'SKILL.md');
              return await this.platform.fs!.readFile(path);
            } catch { /* skip */ }
          }
        }
      }
    } catch { /* skip */ }

    // Try .agents/skills/*/SKILL.md (Codex compatibility)
    try {
      const agentsDir = this.platform.fs.join(dir, '.agents', 'skills');
      if (await this.platform.fs.exists(agentsDir)) {
        const entries = await this.platform.fs.listDir(agentsDir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            try {
              const path = this.platform.fs!.join(agentsDir, entry.name, 'SKILL.md');
              return await this.platform.fs!.readFile(path);
            } catch { /* skip */ }
          }
        }
      }
    } catch { /* skip */ }

    return null;
  }
}
