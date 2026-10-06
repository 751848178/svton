'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { releaseVersionIdentity } from '../../utils/release-version-display.model';

interface Props {
  detail: ReleaseOrderDetail;
  onBack: () => void;
}

export function ReleaseWorkbenchHeader(props: Props) {
  const t = useTranslations('projects');
  const { detail } = props;
  const identity = releaseVersionIdentity(detail.releaseVersion, detail.releaseName);

  return (
    <header className="border-b pb-5">
      <div className="flex min-w-0 items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="mt-0.5 shrink-0"
          aria-label={t('projectOverviewAction')}
          title={t('projectOverviewAction')}
          onClick={props.onBack}
        >
          <ArrowLeft
            size={19}
            aria-hidden="true"
          />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-semibold tracking-[-0.7px]">
            {t('releaseBasicVersionTitle', { version: identity.version })}
          </h1>
        </div>
      </div>
    </header>
  );
}
