'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { EnvironmentVersionActionResult } from '../../types/environment-version.types';
import type { EnvironmentVersionEnvironment } from '../../types/environment-version.types';
import { EnvironmentRecoveryDialog } from '../environment-recovery-dialog';

type ExecuteVersionAction = (
  environmentId: string,
  input: { kind: 'recovery'; sourceVersionId: string },
) => Promise<EnvironmentVersionActionResult | null>;

export function EnvironmentVersionRecoveryControl(props: {
  projectId: string;
  environment: EnvironmentVersionEnvironment;
  execute: ExecuteVersionAction;
  refresh: () => Promise<unknown>;
}) {
  const t = useTranslations('projects');
  const [open, setOpen] = useState(false);
  const historical = props.environment.environmentVersions
    .filter((version) => version.id !== props.environment.currentEnvironmentVersionId)
    .sort((left, right) => Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt));

  if (historical.length === 0) return null;
  const direct = props.environment.baselineRole !== 'production';
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {t('environmentVersionRecoveryDialogTitle')}
      </Button>
      {open ? (
        <EnvironmentRecoveryDialog
          projectId={props.projectId}
          environment={props.environment}
          defaultSourceVersionId={historical[0].id}
          onClose={() => setOpen(false)}
          onDirectConfirm={
            direct
              ? async (sourceVersionId) => {
                  const result = await props.execute(props.environment.id, {
                    kind: 'recovery',
                    sourceVersionId,
                  });
                  if (!result) throw new Error(t('environmentVersionRecoveryFailed'));
                }
              : undefined
          }
          onConfirmed={() => {
            setOpen(false);
            void props.refresh();
          }}
        />
      ) : null}
    </>
  );
}
