'use client';

import { useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { shortTechnicalId } from '../../utils/release-display.utils';
import { ReleaseProductionRunLogTabs } from './release-production-run-log-tabs';

interface Props {
  run: ReleaseEvidenceProductionRun | null;
  onClose: () => void;
}

export function ReleaseProductionRunLogDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  return (
    <Drawer
      open={Boolean(props.run)}
      onClose={props.onClose}
      title={t('releaseProductionLogTitle', {
        id: props.run ? shortTechnicalId(props.run.id) : '—',
      })}
      description={t('releaseProductionLogDescription')}
      width="min(960px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      {props.run ? <ReleaseProductionRunLogTabs run={props.run} /> : null}
    </Drawer>
  );
}
