'use client';

import { useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { ReleaseProductionRunHistory } from './release-production-run-history';

export function ReleaseProductionHistoryDrawer(props: {
  open: boolean;
  runs: ReleaseEvidenceProductionRun[];
  focusedRunId?: string;
  onOpenLog: (runId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      title={t('releaseProductionRunHistoryTitle')}
      description={t('releaseProductionHistoryDescription')}
      width="min(1120px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      <ReleaseProductionRunHistory
        runs={props.runs}
        focusedRunId={props.focusedRunId}
        onOpenLog={props.onOpenLog}
      />
    </Drawer>
  );
}
