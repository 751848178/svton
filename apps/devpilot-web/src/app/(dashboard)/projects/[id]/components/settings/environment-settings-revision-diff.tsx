'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { SettingsRevisionChange } from './settings-revision-review.model';

export function EnvironmentSettingsRevisionDiff({
  changes,
}: {
  changes: SettingsRevisionChange[];
}) {
  const t = useTranslations('projects');
  return (
    <section>
      <h3 className="text-sm font-semibold">{t('configRevisionDiffTitle')}</h3>
      <div className="mt-2 space-y-3 sm:hidden">
        {changes.map((change) => (
          <article
            key={change.area}
            className="rounded-lg border p-3"
          >
            <h4 className="text-sm font-semibold">{t(`configRevisionArea_${change.area}`)}</h4>
            <dl className="mt-3 space-y-3 text-sm">
              <DiffFact
                label={t('configRevisionDiffBefore')}
                value={change.before}
                muted
              />
              <DiffFact
                label={t('configRevisionDiffAfter')}
                value={change.after}
              />
              <DiffFact
                label={t('configRevisionImpact')}
                value={t(`configRevisionImpact_${change.area}`)}
                muted
              />
            </dl>
          </article>
        ))}
      </div>
      <div className="mt-2 hidden overflow-x-auto rounded-lg border sm:block">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t('configRevisionDiffArea')}</th>
              <th className="px-3 py-2">{t('configRevisionDiffBefore')}</th>
              <th className="px-3 py-2">{t('configRevisionDiffAfter')}</th>
              <th className="px-3 py-2">{t('configRevisionImpact')}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr
                key={change.area}
                className="border-b last:border-b-0"
              >
                <td className="px-3 py-3 font-medium">{t(`configRevisionArea_${change.area}`)}</td>
                <td className="max-w-60 break-words px-3 py-3 text-muted-foreground">
                  {change.before}
                </td>
                <td className="max-w-60 break-words px-3 py-3">{change.after}</td>
                <td className="max-w-56 break-words px-3 py-3 text-muted-foreground">
                  {t(`configRevisionImpact_${change.area}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DiffFact(props: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className={`mt-1 break-words ${props.muted ? 'text-muted-foreground' : ''}`}>
        {props.value}
      </dd>
    </div>
  );
}
