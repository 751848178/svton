'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { stagingLogDisplay } from '../release-staging-log.model';

export function ReleaseStagingLogOutput(props: {
  title: string;
  value: unknown;
  empty?: string;
  danger?: boolean;
  role?: 'log';
}) {
  const t = useTranslations('projects');
  const content = stagingLogDisplay(props.value, props.empty || t('releaseWorkbenchValueEmpty'));
  return (
    <section className={props.danger ? 'text-destructive' : undefined}>
      <h4 className="text-sm font-semibold">{props.title}</h4>
      <pre
        className="mt-3 whitespace-pre-wrap break-all rounded-md bg-muted p-4 font-mono text-xs text-foreground"
        role={props.role}
      >
        {content}
      </pre>
    </section>
  );
}
