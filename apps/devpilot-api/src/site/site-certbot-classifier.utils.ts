/**
 * Pure certbot renewal output classification + summary helpers.
 * Extracted from `site-tls-renew.ts` to bring it under the file-size ceiling.
 */

import { collectText, isRecord } from './site-tls-openssl-parser.utils';

export type SiteTlsRenewalStatus = 'succeeded' | 'not_due' | 'failed' | 'unknown';

export function classifyCertbotRenewOutput(
  text: string,
  executionStatus?: string,
): { status: SiteTlsRenewalStatus; attempted: boolean; summary?: string } {
  const lower = text.toLowerCase();

  if (executionStatus === 'failed') {
    return { status: 'failed', attempted: true, summary: selectSummaryLine(text, ['failed', 'error', 'unable', 'could not']) };
  }

  if (/congratulations/.test(lower) || /successfully renewed/.test(lower) || /renewal succeeded/.test(lower) || /all renewals succeeded/.test(lower) || /all simulated renewals succeeded/.test(lower)) {
    return { status: 'succeeded', attempted: true, summary: selectSummaryLine(text, ['congratulations', 'successfully renewed', 'renewal succeeded', 'all renewals succeeded', 'all simulated renewals succeeded']) };
  }

  if (/no renewals were attempted/.test(lower) || /not due for renewal/.test(lower) || /not yet due/.test(lower) || /skipping/.test(lower)) {
    return { status: 'not_due', attempted: false, summary: selectSummaryLine(text, ['no renewals were attempted', 'not due for renewal', 'not yet due', 'skipping']) };
  }

  if (/failed/.test(lower) || /error/.test(lower) || /unable to renew/.test(lower) || /could not/.test(lower)) {
    return { status: 'failed', attempted: true, summary: selectSummaryLine(text, ['failed', 'error', 'unable to renew', 'could not']) };
  }

  return { status: executionStatus === 'completed' ? 'unknown' : 'failed', attempted: executionStatus !== 'completed', summary: selectSummaryLine(text, []) };
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
