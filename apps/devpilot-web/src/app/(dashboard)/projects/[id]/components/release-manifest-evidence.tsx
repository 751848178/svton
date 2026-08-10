'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { ReleaseBuildItem } from '../types/release-order.types';

export function ReleaseManifestEvidence({ manifest }: { manifest: ReleaseBuildItem['manifest'] }) {
  const t = useTranslations('projects');
  if (!manifest?.items.length) return null;
  return (
    <section
      className="space-y-2 rounded-md border p-3"
      aria-label={t('releaseManifestEvidenceTitle')}
    >
      <h3 className="font-medium">{t('releaseManifestEvidenceTitle')}</h3>
      {manifest.items.map((item) => (
        <article
          key={item.componentKey}
          className="rounded bg-muted/40 p-3 text-xs"
          data-manifest-component={item.componentKey}
        >
          <p className="font-medium">
            {item.componentKey} · {item.artifactType}
          </p>
          <p className="mt-1 break-all font-mono text-muted-foreground">{item.digest}</p>
          <p className="mt-1 break-all font-mono">{item.uri}</p>
        </article>
      ))}
    </section>
  );
}
