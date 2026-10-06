'use client';

import React, { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ErrorBanner, Modal } from '@/components/ui';
import { useEnvironmentVersions } from '../hooks/use-environment-versions';
import { approvedEnvironmentVersionRun } from './environment-version-card';
import {
  environmentVersionLabel,
  ProjectEnvironmentVersionRow,
  type EnvironmentVersionSelection,
} from './project-environment-version-row';
import { PROJECT_TABLE_CLASS, ProjectTableSurface } from './project-workbench-surface';

export function ProjectEnvironmentVersionsTable({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const versions = useEnvironmentVersions(projectId);
  const [selection, setSelection] = useState<EnvironmentVersionSelection | null>(null);
  const candidates = selection
    ? (versions.candidates[selection.environment.baselineRole] ?? [])
    : [];
  const candidate = candidates.find((item) => item.id === selection?.candidateId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selection || !candidate) return;
    const releaseRunId = approvedEnvironmentVersionRun(candidate);
    const result = await versions.execute(selection.environment.id, {
      kind: 'upgrade',
      manifestId: candidate.id,
      releaseRunId: selection.environment.baselineRole === 'production' ? releaseRunId : undefined,
    });
    if (result) setSelection(null);
  };

  return (
    <>
      <ProjectTableSurface variant="embedded">
        {versions.error ? (
          <div className="p-4">
            <ErrorBanner
              message={versions.error}
              onRetry={versions.load}
              retryLabel={tc('retry')}
            />
          </div>
        ) : (
          <table className={`${PROJECT_TABLE_CLASS} min-w-[820px]`}>
            <caption className="sr-only">
              {t('environmentVersionsOverviewTitle')}. {t('environmentVersionsOverviewDescription')}
            </caption>
            <thead>
              <tr>
                <th>{t('environmentVersionColumnEnvironment')}</th>
                <th>{t('environmentVersionsCurrentVersionColumn')}</th>
                <th>{t('releaseOrderColumnSource')}</th>
                <th>{t('environmentVersionLatestDeployedAt')}</th>
                <th>{t('releaseOrderColumnStatus')}</th>
                <th className="text-right">{t('environmentVersionColumnAction')}</th>
              </tr>
            </thead>
            <tbody>
              {versions.environments.map((environment) => (
                <ProjectEnvironmentVersionRow
                  key={environment.id}
                  projectId={projectId}
                  environment={environment}
                  candidates={versions.candidates[environment.baselineRole] ?? []}
                  onSwitch={setSelection}
                />
              ))}
              {!versions.loading && versions.environments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {t('environmentVersionsEmptyDescription')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </ProjectTableSurface>
      <Modal
        open={Boolean(selection)}
        onClose={() => setSelection(null)}
        title={t('environmentVersionSwitchDialogTitle')}
        ariaCloseLabel={tc('close')}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void submit(event)}
        >
          {versions.error ? (
            <ErrorBanner
              message={versions.error}
              onRetry={versions.load}
              retryLabel={tc('retry')}
            />
          ) : null}
          <p className="text-sm text-muted-foreground">
            {selection
              ? t('environmentVersionSwitchDialogDescription', {
                  environment: selection.environment.name,
                })
              : ''}
          </p>
          <label className="block text-sm font-medium">
            {t('environmentVersionTargetLabel')}
            <select
              className="mt-1 h-10 w-full rounded-lg border bg-background px-3 font-normal"
              value={selection?.candidateId ?? ''}
              onChange={(event) =>
                setSelection((current) =>
                  current ? { ...current, candidateId: event.target.value } : null,
                )
              }
            >
              {candidates.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {environmentVersionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSelection(null)}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              loading={versions.executing}
              disabled={!candidate}
            >
              {tc('confirm')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
