/**
 * Pure certbot renewal output classification + summary helpers.
 * Extracted from `site-tls-renew.ts` to bring it under the file-size ceiling.
 *
 * 分类信号优先级（强 → 弱）：
 *  1. executionStatus（来自 SSH exit code）：`'failed'` = exit≠0，`'completed'` = exit 0。
 *     这是最可靠的信号——certbot renew exit 0 = 无失败（成功续期或无需续期）。
 *  2. stdout 正则：仅用于在 exit 0 的前提下细分 `succeeded` / `not_due`，以及提取 summary。
 *     不再让 stdout 单独决定 `failed`（locale/版本敏感，已降级为辅助）。
 */

import { collectText, isRecord } from './site-tls-openssl-parser.utils';

export type SiteTlsRenewalStatus = 'succeeded' | 'not_due' | 'failed' | 'unknown';

export function classifyCertbotRenewOutput(
  text: string,
  executionStatus?: string,
): { status: SiteTlsRenewalStatus; attempted: boolean; summary?: string } {
  const lower = text.toLowerCase();

  // 1. exit code 主信号：执行失败
  if (executionStatus === 'failed') {
    return { status: 'failed', attempted: true, summary: selectSummaryLine(text, ['failed', 'error', 'unable', 'could not']) };
  }

  // 2. exit code 主信号：执行成功（exit 0）。certbot renew exit 0 表示无失败，
  //    但需区分"成功续期"与"无需续期"——用 stdout 正则做细分。
  if (executionStatus === 'completed') {
    if (/no renewals were attempted/.test(lower) || /not due for renewal/.test(lower) || /not yet due/.test(lower) || /skipping/.test(lower)) {
      return { status: 'not_due', attempted: false, summary: selectSummaryLine(text, ['no renewals were attempted', 'not due for renewal', 'not yet due', 'skipping']) };
    }
    // exit 0 且无"无需续期"信号 → 视为 succeeded。
    // stdout 显式含错误关键词时仍标 failed（防御性：个别情况下 exit 0 但 stdout 报错，
    // 如 dry-run 部分失败的边缘场景），否则 succeeded。
    if (/failed|error|unable to renew|could not/.test(lower)) {
      return { status: 'failed', attempted: true, summary: selectSummaryLine(text, ['failed', 'error', 'unable to renew', 'could not']) };
    }
    return { status: 'succeeded', attempted: true, summary: selectSummaryLine(text, ['congratulations', 'successfully renewed', 'renewal succeeded', 'all renewals succeeded', 'all simulated renewals succeeded']) };
  }

  // 3. 无 executionStatus（防御性回退）：保持原 stdout 正则逻辑
  if (/congratulations/.test(lower) || /successfully renewed/.test(lower) || /renewal succeeded/.test(lower) || /all renewals succeeded/.test(lower) || /all simulated renewals succeeded/.test(lower)) {
    return { status: 'succeeded', attempted: true, summary: selectSummaryLine(text, ['congratulations', 'successfully renewed', 'renewal succeeded', 'all renewals succeeded', 'all simulated renewals succeeded']) };
  }

  if (/no renewals were attempted/.test(lower) || /not due for renewal/.test(lower) || /not yet due/.test(lower) || /skipping/.test(lower)) {
    return { status: 'not_due', attempted: false, summary: selectSummaryLine(text, ['no renewals were attempted', 'not due for renewal', 'not yet due', 'skipping']) };
  }

  if (/failed/.test(lower) || /error/.test(lower) || /unable to renew/.test(lower) || /could not/.test(lower)) {
    return { status: 'failed', attempted: true, summary: selectSummaryLine(text, ['failed', 'error', 'unable to renew', 'could not']) };
  }

  return { status: 'unknown', attempted: false, summary: selectSummaryLine(text, []) };
}

export function selectSummaryLine(text: string, keywords: string[]) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const matched = lowerKeywords.length > 0
    ? lines.find((line) => lowerKeywords.some((keyword) => line.toLowerCase().includes(keyword)))
    : lines[0];
  return truncateSummary(matched);
}

export function fallbackSummary(status: SiteTlsRenewalStatus, dryRun: boolean) {
  if (status === 'succeeded') return dryRun ? 'Certbot renewal dry-run succeeded' : 'Certbot renewal succeeded';
  if (status === 'not_due') return 'Certificate is not due for renewal';
  if (status === 'failed') return dryRun ? 'Certbot renewal dry-run failed' : 'Certbot renewal failed';
  return 'Certbot renewal completed with unknown result';
}

function truncateSummary(value?: string) {
  if (!value) return undefined;
  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}

export { collectText, isRecord };
