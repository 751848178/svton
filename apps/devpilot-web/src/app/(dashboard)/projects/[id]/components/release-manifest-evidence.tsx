/**
 * Manifest 制品展示（单一职责：同一份 manifest 的两种读法）。
 * - ReleaseManifestEvidence：主层人读清单——组件名 · 类型 · 大小 · 短 digest。
 * - ReleaseManifestRawEvidence：技术详情内的机器证据行——完整 digest 与内部 URI。
 * 组件名由调用方注入（项目组件表映射）；无法映射的 cuid 折叠为短 ID。
 */
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { formatByteSize, shortDigest, shortTechnicalId } from '../utils/release-display.utils';

type ManifestItem = ReleaseBuildItem['manifest'] extends null
  ? never
  : NonNullable<ReleaseBuildItem['manifest']>['items'][number];

export function ReleaseManifestEvidence(props: {
  manifest: ReleaseBuildItem['manifest'];
  componentNames?: Record<string, string>;
}) {
  const t = useTranslations('projects');
  if (!props.manifest?.items.length) return null;
  return (
    <section
      aria-label={t('releaseManifestArtifactList')}
      data-testid="release-manifest-evidence"
    >
      <h3 className="text-sm font-medium">{t('releaseManifestArtifactList')}</h3>
      <ul className="mt-2 space-y-1.5">
        {props.manifest.items.map((item) => (
          <li
            key={item.componentKey}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
            data-manifest-component={item.componentKey}
          >
            <span className="font-medium">{displayName(item, props.componentNames)}</span>
            <span className="text-xs text-muted-foreground">{item.artifactType}</span>
            {readSize(item) ? (
              <span className="text-xs text-muted-foreground">{readSize(item)}</span>
            ) : null}
            <span
              className="font-mono text-xs text-muted-foreground"
              title={item.digest}
            >
              {shortDigest(item.digest)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReleaseManifestRawEvidence({
  manifest,
}: {
  manifest: ReleaseBuildItem['manifest'];
}) {
  if (!manifest?.items.length) return null;
  return (
    <div
      className="mt-3 space-y-1 border-t pt-2"
      data-testid="release-manifest-raw-evidence"
    >
      {manifest.items.map((item) => (
        <p
          key={item.componentKey}
          className="break-all font-mono text-[11px] text-muted-foreground"
        >
          {item.componentKey} · {item.digest}
          <br />
          {item.uri}
        </p>
      ))}
    </div>
  );
}

function displayName(item: ManifestItem, componentNames?: Record<string, string>) {
  return (
    componentNames?.[item.componentKey] ??
    (/^c[a-z0-9]{24}$/.test(item.componentKey)
      ? shortTechnicalId(item.componentKey)
      : item.componentKey)
  );
}

function readSize(item: ManifestItem) {
  const size = (item.metadata as Record<string, unknown> | null)?.sizeBytes;
  return typeof size === 'number' ? formatByteSize(size) : null;
}
