// Pure helpers for the init wizard orchestration: readiness aggregation and the
// post-write gitignore re-verification (R2). Kept out of wizard.ts so the
// orchestration file stays within the 200-line structure budget.

import type { AgentCheckResult } from './checks.js';
import { verifySecretIgnored } from './gitignore.js';

export function readiness(builder: AgentCheckResult | null, runtime: AgentCheckResult | null): { ready: boolean; pending: string[] } {
  const pending: string[] = [];
  if (builder && !builder.passed) pending.push(`构建机检查未通过：${builder.detail}`);
  if (runtime && !runtime.passed) pending.push(`运行机检查未通过：${runtime.detail}`);
  return { ready: pending.length === 0, pending };
}

/** R2: re-verify git's effective verdict after writing — never claim protection
 *  the repo does not actually grant */
export function appendIgnoreRecheck(cwd: string, plan: { files: Array<{ secret?: boolean; rel: string }> }, wroteConfig: boolean, warnings: string[]): void {
  const configRel = plan.files.find((f) => f.secret)?.rel;
  if (!configRel || !wroteConfig) return;
  if (verifySecretIgnored(cwd, configRel) === false) {
    warnings.push(`写入后复检：${configRel} 仍未被 Git 忽略（可能存在更晚的否定规则）；请手工调整 .gitignore，切勿提交该文件。`);
  }
}
