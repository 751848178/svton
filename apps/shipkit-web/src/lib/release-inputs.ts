import type { Plan } from './contracts';
import type { ServiceSource } from './source-contracts';

export function planServiceSource(plan: Plan, key: string): ServiceSource | null | undefined {
  if (plan.kind === 'rollback') return plan.detail.history?.restoreServices?.[key]?.source;
  if (plan.kind === 'config-only' || !plan.selection.includes(key)) return plan.detail.currentSources?.[key];
  const source = plan.detail.sourceSnapshot;
  if (source) return { type: 'git', repo: source.repoUrl, ref: source.requestedRef.value, sha: source.commit };
  if (plan.detail.gitRef || plan.detail.sourceDigest) return { type: plan.sourceMode === 'git' ? 'git' : 'tarball', sha: plan.detail.gitRef, contentDigest: plan.detail.sourceDigest };
  return undefined;
}
