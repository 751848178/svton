/** A skill returned by listing/search endpoints. */
export interface RemoteSkill {
  /** Stable unique id: "owner/repo/skill-slug" */
  id: string;
  /** URL-safe slug: "next-js-development" */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Source repo or provider: "vercel-labs/agent-skills" */
  source: string;
  /** Total deduplicated install count */
  installs: number;
  /** "github" or "well-known" */
  sourceType: string;
  /** GitHub repo URL or well-known base URL */
  installUrl: string | null;
  /** Direct link to the skill page on skills.sh */
  url: string;
}

/** A file inside a skill detail response. */
export interface RemoteSkillFile {
  path: string;
  contents: string;
}

/** Detailed skill info from the detail endpoint. */
export interface RemoteSkillDetail {
  id: string;
  source: string;
  slug: string;
  installs: number;
  hash: string | null;
  files: RemoteSkillFile[] | null;
}

/** Security audit result from a single provider. */
export interface AuditEntry {
  provider: string;
  slug: string;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  auditedAt?: string;
  riskLevel?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/** Security audit response. */
export interface AuditResponse {
  id: string;
  source: string;
  slug: string;
  audits: AuditEntry[];
}

/** Skill shaped for UI display in the marketplace panel. */
export interface MarketplaceSkill {
  id: string;
  name: string;
  source: string;
  installs: number;
  url: string;
  /** Whether this skill is already installed locally */
  installed: boolean;
}
