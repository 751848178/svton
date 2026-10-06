'use client';

import { useTranslations } from 'next-intl';
import { Modal, StatusTag } from '@/components/ui';
import type { ProjectService } from '../types';
import {
  projectComponentAnalysisCommit,
  projectComponentPath,
  projectComponentPorts,
} from '../utils/project-component-display.model';
import { getServiceStatusLabelKey } from '../utils/service-status.model';

export function ProjectComponentDetailsModal(props: {
  service: ProjectService | null;
  applicationName: string;
  onClose: () => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const service = props.service;
  return (
    <Modal
      open={Boolean(service)}
      onClose={props.onClose}
      title={service ? service.name : t('projectComponentDetailsTitle')}
      ariaCloseLabel={tc('close')}
    >
      {service ? (
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Fact
            label={t('projectComponentApplication')}
            value={props.applicationName}
          />
          <Fact
            label={t('componentColumnRuntime')}
            value={service.runtime || service.kind || '—'}
          />
          <Fact
            label={t('componentColumnPath')}
            value={projectComponentPath(service)}
            mono
          />
          <Fact
            label={t('componentColumnPorts')}
            value={projectComponentPorts(service)}
            mono
          />
          <Fact
            label={t('componentLastAppliedAnalysis')}
            value={projectComponentAnalysisCommit(service)}
            mono
          />
          <div>
            <dt className="text-xs text-muted-foreground">{t('componentColumnStatus')}</dt>
            <dd className="mt-1">
              <StatusTag
                status={service.status}
                label={t(getServiceStatusLabelKey(service.status))}
              />
            </dd>
          </div>
        </dl>
      ) : null}
    </Modal>
  );
}

function Fact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className={`mt-1 break-all ${props.mono ? 'font-mono text-xs' : 'font-medium'}`}>
        {props.value}
      </dd>
    </div>
  );
}
