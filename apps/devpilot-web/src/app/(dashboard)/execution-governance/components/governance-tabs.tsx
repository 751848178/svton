'use client';

import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import type { useExecutionGovernance } from '../hooks/use-execution-governance';
import { SupervisorPanel } from './supervisor-panel';
import { JobList } from './job-list';
import { LeaseList } from './lease-list';

type GovernanceHook = ReturnType<typeof useExecutionGovernance>;

/**
 * 治理运行时标签页:把原本纵向平铺的「主管代理 / 作业 / 租约」三块收纳到水平 Tabs,
 * 让概览卡(GovernanceOverview)成为页面唯一的视觉焦点,详情按需切换。
 * 单一职责:仅做布局收纳,数据与动作全部来自 useExecutionGovernance。
 */
export function GovernanceTabs({ gov }: { gov: GovernanceHook }) {
  const t = useTranslations('executionGovernance');

  return (
    <Tabs
      type="line"
      items={[
        {
          key: 'supervisor',
          label: t('tabSupervisor'),
          children: (
            <section className="space-y-4 pt-2">
              <div>
                <h2 className="text-lg font-semibold">{t('supervisorTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('supervisorSubtitle')}</p>
              </div>
              <SupervisorPanel
                supervisor={gov.supervisor}
                loading={gov.supervisorLoading}
                error={gov.supervisorError}
                onRetry={gov.reload}
              />
            </section>
          ),
        },
        {
          key: 'jobs',
          label: t('tabJobs'),
          children: (
            <JobList
              jobs={gov.jobs}
              loading={gov.jobLoading}
              jobStatus={gov.jobStatus}
              onJobStatusChange={gov.setJobStatus}
              stats={gov.jobStats}
              actingJobId={gov.actingJobId}
              onRetry={gov.retryJob}
              onCancel={gov.cancelJob}
            />
          ),
        },
        {
          key: 'leases',
          label: t('tabLeases'),
          children: (
            <LeaseList
              leases={gov.leases}
              loading={gov.leaseLoading}
              leaseStatus={gov.leaseStatus}
              onLeaseStatusChange={gov.setLeaseStatus}
              stats={gov.leaseStats}
            />
          ),
        },
      ]}
    />
  );
}
