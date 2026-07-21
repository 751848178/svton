import type { IStorage } from '@svton/agent-platform';
import { SkillLoader } from './loader';
import type { InstallResult } from './installer';
import { installMarketplaceSkill } from './marketplace-install.service';
import type {
  AuditEntry,
  AuditResponse,
  MarketplaceSkill,
  RemoteSkill,
  RemoteSkillDetail,
} from './marketplace.types';

export type {
  AuditEntry,
  AuditResponse,
  MarketplaceSkill,
  RemoteSkill,
  RemoteSkillDetail,
  RemoteSkillFile,
} from './marketplace.types';

const DEFAULT_REGISTRY_URL = 'https://skills.sh';

// ── SkillMarketplace ─────────────────────────────────────

/**
 * Client for the skills.sh marketplace API.
 *
 * Provides search, browsing, detail, security audit, and one-click install.
 * No API key required (60 req/min unauthenticated rate limit).
 */
export class SkillMarketplace {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(registryUrl?: string, apiKey?: string) {
    this.baseUrl = registryUrl || DEFAULT_REGISTRY_URL;
    this.headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  // ── Search ──

  /**
   * Search skills by name, source, or description.
   * Single-word → fuzzy match. Multi-word → semantic search.
   */
  async search(query: string, limit?: number): Promise<RemoteSkill[]> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', String(limit));

    const resp = await this.fetch(`/api/v1/skills/search?${params}`);
    const data = await resp.json();
    return data.data ?? [];
  }

  // ── Browsing ──

  /**
   * Paginated leaderboard of all skills.
   */
  async list(options?: {
    view?: 'all-time' | 'trending' | 'hot';
    page?: number;
    perPage?: number;
  }): Promise<{ skills: RemoteSkill[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.view) params.set('view', options.view);
    if (options?.page !== undefined) params.set('page', String(options.page));
    if (options?.perPage !== undefined) params.set('per_page', String(options.perPage));

    const resp = await this.fetch(`/api/v1/skills?${params}`);
    const data = await resp.json();
    return {
      skills: data.data ?? [],
      total: data.pagination?.total ?? 0,
    };
  }

  /**
   * Official curated first-party skills (from companies building the tech).
   */
  async curated(): Promise<RemoteSkill[]> {
    const resp = await this.fetch('/api/v1/skills/curated');
    const data = await resp.json();

    // Curated response groups by owner; flatten into skill list
    if (Array.isArray(data.data)) {
      const skills: RemoteSkill[] = [];
      for (const owner of data.data) {
        if (Array.isArray(owner.skills)) {
          skills.push(...owner.skills);
        }
      }
      return skills;
    }
    return [];
  }

  // ── Detail ──

  /**
   * Get full detail of a skill, including SKILL.md file contents.
   * Use the `id` from search/list results.
   */
  async getDetail(skillId: string): Promise<RemoteSkillDetail> {
    const resp = await this.fetch(`/api/v1/skills/${skillId}`);
    return resp.json();
  }

  // ── Security Audit ──

  /**
   * Get security audit results for a skill from partners
   * (Socket, Snyk, Agent Trust Hub, etc.).
   */
  async getAudit(skillId: string): Promise<AuditEntry[]> {
    try {
      const resp = await this.fetch(`/api/v1/skills/audit/${skillId}`);
      if (!resp.ok) return [];
      const data: AuditResponse = await resp.json();
      return data.audits ?? [];
    } catch {
      return [];
    }
  }

  // ── One-click Install ──

  /**
   * Install a skill from the marketplace into IStorage.
   */
  async install(skillId: string, storage: IStorage): Promise<InstallResult> {
    return installMarketplaceSkill({
      skillId,
      storage,
      getDetail: (id) => this.getDetail(id),
    });
  }

  // ── Helpers ──

  /**
   * Convert RemoteSkill[] to MarketplaceSkill[] with installed status.
   */
  async toMarketplaceSkills(
    remote: RemoteSkill[],
    storage: IStorage,
  ): Promise<MarketplaceSkill[]> {
    // Batch-check installed status
    const installedNames = new Set<string>();
    try {
      const installedSkills = await SkillLoader.fromInstalled(storage);
      for (const s of installedSkills) installedNames.add(s.name);
    } catch {
      // Ignore
    }

    return remote.map((r) => ({
      id: r.id,
      name: r.name,
      source: r.source,
      installs: r.installs,
      url: r.url,
      installed: installedNames.has(r.name),
    }));
  }

  private async fetch(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    try {
      const resp = await globalThis.fetch(url, {
        headers: this.headers,
      });
      if (!resp.ok) {
        throw new Error(`API returned ${resp.status} ${resp.statusText}`);
      }
      return resp;
    } catch (e: any) {
      if (e?.message?.includes('Failed to fetch') || e?.name === 'TypeError') {
        throw new Error(`无法连接到技能市场 (${this.baseUrl})。请检查网络连接。`);
      }
      throw e;
    }
  }
}
