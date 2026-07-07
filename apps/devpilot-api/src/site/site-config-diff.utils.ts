/**
 * Pure nginx-config diff helpers for site sync/probe plans. Extracted from
 * `SiteService`. The async `buildConfigDiff` (which reads the baseline run from
 * Prisma) stays on the host; it delegates the actual diff math to these pure
 * functions.
 */

import { type SiteConfigDiff } from './site-plan.types';

export function diffConfigText(previousConfig: string, nextConfig: string) {
  const previousLines = previousConfig ? previousConfig.split('\n') : [];
  const nextLines = nextConfig ? nextConfig.split('\n') : [];
  const maxLength = Math.max(previousLines.length, nextLines.length);
  const lines: string[] = [];
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const previousLine = previousLines[index];
    const nextLine = nextLines[index];

    if (previousLine === nextLine && nextLine !== undefined) {
      unchanged += 1;
      lines.push(` ${String(index + 1).padStart(4, ' ')} | ${nextLine}`);
      continue;
    }

    if (previousLine !== undefined) {
      removed += 1;
      lines.push(`-${String(index + 1).padStart(4, ' ')} | ${previousLine}`);
    }
    if (nextLine !== undefined) {
      added += 1;
      lines.push(`+${String(index + 1).padStart(4, ' ')} | ${nextLine}`);
    }
  }

  const maxLines = 240;
  const clipped = lines.length > maxLines;

  return {
    added,
    removed,
    unchanged,
    unifiedDiff: [
      '--- last-successful-nginx.conf',
      '+++ planned-nginx.conf',
      ...lines.slice(0, maxLines),
      ...(clipped ? [`... diff truncated, ${lines.length - maxLines} more lines`] : []),
    ].join('\n'),
  };
}

export function buildNoConfigDiff(summary: string): SiteConfigDiff {
  return {
    sourceRunId: null,
    hasBaseline: false,
    hasChanges: false,
    added: 0,
    removed: 0,
    unchanged: 0,
    summary,
    unifiedDiff: [
      '--- last-successful-nginx.conf',
      '+++ planned-nginx.conf',
      summary,
    ].join('\n'),
  };
}

/** Shape a baseline-read + diff into the final SiteConfigDiff (pure given inputs). */
export function buildConfigDiffFromBaseline(
  nextConfig: string,
  baselineRun: { id: string; nginxConfig: PrismaJson } | null,
  sourceRunId?: string | null,
): SiteConfigDiff {
  const baselineConfig = baselineRun?.nginxConfig ? String(baselineRun.nginxConfig) : '';
  const diff = diffConfigText(baselineConfig, nextConfig);
  const hasBaseline = Boolean(baselineRun);
  const hasChanges = !hasBaseline || diff.added > 0 || diff.removed > 0;

  return {
    sourceRunId: baselineRun?.id || sourceRunId || null,
    hasBaseline,
    hasChanges,
    added: diff.added,
    removed: diff.removed,
    unchanged: diff.unchanged,
    summary: hasBaseline
      ? (hasChanges
        ? `与最近成功配置相比：新增 ${diff.added} 行，删除 ${diff.removed} 行`
        : '与最近成功配置无差异')
      : `暂无成功配置快照，本次将新增 ${diff.added} 行配置`,
    unifiedDiff: diff.unifiedDiff,
  };
}

type PrismaJson = unknown;
