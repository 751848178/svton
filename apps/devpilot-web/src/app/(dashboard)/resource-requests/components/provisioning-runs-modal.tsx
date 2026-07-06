/** 供给运行记录弹窗 - 展示运行历史、重放、provider 对账。 */
'use client';

import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { Modal, ErrorBanner } from '@/components/ui';
import type { ResourceRequest, ResourceProvisioningRun } from '../types';
import { ProvisioningRunRow } from './provisioning-run-row.component';

export function ProvisioningRunsModal({
  request,
  runs,
  loading,
  error,
  replayingRunId,
  reconcilingRunId,
  onReplay,
  onReconcile,
  onClose,
}: {
  request: ResourceRequest;
  runs: ResourceProvisioningRun[];
  loading: boolean;
  error: string;
  replayingRunId: string | null;
  reconcilingRunId: string | null;
  onReplay: (run: ResourceProvisioningRun) => void;
  onReconcile: (run: ResourceProvisioningRun) => void;
  onClose: () => void;
}) {
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-5xl p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t('deliveryRunRecords')}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {request.title} · {request.resourceType?.name || t('resource')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-sm rounded border hover:bg-accent"
          >
            {tc('close')}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t('loadingRunRecords')}</div>
        ) : runs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t('noExternalRunRecords')}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{tc('status')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('triggerMode')}</th>
                  <th className="px-3 py-2 text-left font-medium">Adapter</th>
                  <th className="px-3 py-2 text-left font-medium">{t('attempts')}</th>
                  <th className="px-3 py-2 text-left font-medium">Provider</th>
                  <th className="px-3 py-2 text-left font-medium">{t('time')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('summary')}</th>
                  <th className="px-3 py-2 text-right font-medium">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map((run) => (
                  <ProvisioningRunRow
                    key={run.id}
                    request={request}
                    run={run}
                    replayingRunId={replayingRunId}
                    reconcilingRunId={reconcilingRunId}
                    onReplay={onReplay}
                    onReconcile={onReconcile}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
