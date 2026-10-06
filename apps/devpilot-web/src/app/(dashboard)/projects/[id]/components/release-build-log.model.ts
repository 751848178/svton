import type { ReleaseBuildItem } from '../types/release-order.types';
import { shortTechnicalId } from '../utils/release-display.utils';
import { formatIso } from '../utils/release-time.utils';
import type { ReleaseTechnicalDetailItem } from './release-technical-details';

export function releaseBuildCommitLabel(run: ReleaseBuildItem) {
  if (!run.sourceCommitSha) return run.sourceBranch;
  return `${run.sourceBranch} @ ${run.sourceCommitSha.slice(0, 12)}`;
}

export function releaseBuildTechnicalItems(
  run: ReleaseBuildItem,
  createdAtEqualsStarted: boolean,
  t: (key: string) => string,
): ReleaseTechnicalDetailItem[] {
  const items: ReleaseTechnicalDetailItem[] = [
    { key: 'id', label: t('releaseBuildId'), value: shortTechnicalId(run.id), title: run.id },
    { key: 'revision', label: t('releaseBuildRevisionLabel'), value: String(run.revision) },
  ];
  if (!createdAtEqualsStarted) {
    items.push({
      key: 'createdAt',
      label: t('releaseBuildCreatedAt'),
      value: formatIso(run.createdAt),
    });
  }
  if (run.sourceRepository) {
    items.push(
      {
        key: 'provider',
        label: t('releaseBuildSourceProvider'),
        value: run.sourceRepository.provider,
      },
      {
        key: 'identityRevision',
        label: t('releaseBuildSourceRevision'),
        value: `R${run.sourceRepository.identityRevision}`,
      },
      {
        key: 'repository',
        label: t('releaseBuildSourceRepository'),
        value: run.sourceRepository.canonicalUrl,
      },
    );
  }
  items.push({
    key: 'logReference',
    label: t('releaseBuildLogReference'),
    value: run.logReference || t('releaseWorkbenchValueEmpty'),
  });
  if (run.manifest?.digest) {
    items.push({
      key: 'manifestDigest',
      label: t('releaseBuildManifestDigest'),
      value: run.manifest.digest,
    });
  }
  return items;
}

export function releaseBuildLogSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      redacted: false,
      truncated: false,
      lineCount: 0,
      sourceLineCount: 0,
      lines: [] as string[],
    };
  }
  const summary = value as Record<string, unknown>;
  const redacted = summary.redacted === true;
  const lines =
    redacted && Array.isArray(summary.lines)
      ? summary.lines.filter((line): line is string => typeof line === 'string')
      : [];
  return {
    redacted,
    truncated: redacted && summary.truncated === true,
    lineCount: lines.length,
    sourceLineCount:
      redacted && typeof summary.sourceLineCount === 'number'
        ? summary.sourceLineCount
        : lines.length,
    lines,
  };
}
