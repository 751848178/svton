import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { LogsState } from './use-logs-state';
import type { LogsTailState } from './use-logs-tail-state';
import type { LogStream } from '../types-stream';
import type { ManagedResource, TargetType } from '../types';
import { formatTargetType, sourceTypeForTarget } from '../utils';

interface UseLogsActionsArgs {
  s: LogsState;
  t: LogsTailState;
  selectedStream: LogStream | null;
  isSelectedSlsStream: boolean;
  loadData: () => Promise<void>;
}

export function useLogsActions(args: UseLogsActionsArgs) {
  const { s, t, selectedStream, isSelectedSlsStream, loadData } = args;

  const createStream = usePersistFn(async () => {
    if (s.targetType !== 'manual' && !s.targetId) {
      alert('请选择日志目标');
      return;
    }
    s.setSaving(true);
    s.setError('');
    try {
      const stream = await apiRequest<LogStream>('POST:/logs/streams', buildStreamBody(s));
      s.setStreamName('');
      s.setSourceKey('');
      s.setSelectedStreamId(stream.id);
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '创建日志流失败');
    } finally {
      s.setSaving(false);
    }
  });

  const appendEntry = usePersistFn(async () => {
    if (!s.selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    if (!s.entryMessage.trim()) {
      alert('请输入日志内容');
      return;
    }
    s.setAppending(true);
    s.setError('');
    try {
      await apiRequest(`POST:/logs/streams/${s.selectedStreamId}/entries`, {
        level: s.entryLevel,
        message: s.entryMessage,
        source: 'manual',
      });
      s.setEntryMessage('');
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '追加日志失败');
    } finally {
      s.setAppending(false);
    }
  });

  const collectSelectedStream = usePersistFn(async () => {
    if (!s.selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    s.setCollecting(true);
    s.setError('');
    try {
      await apiRequest(
        `POST:/logs/streams/${s.selectedStreamId}/collect`,
        buildCollectionBody({ t, selectedStream, isSelectedSlsStream }),
      );
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '生成采集计划失败');
    } finally {
      s.setCollecting(false);
    }
  });

  const cleanupSelectedRetention = usePersistFn(async (dryRun: boolean) => {
    if (!s.selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    t.setCleaningRetention(dryRun ? 'dry-run' : 'live');
    s.setError('');
    try {
      await apiRequest(`POST:/logs/streams/${s.selectedStreamId}/retention/cleanup`, {
        dryRun,
      });
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '日志保留清理失败');
    } finally {
      t.setCleaningRetention('');
    }
  });

  return { createStream, appendEntry, collectSelectedStream, cleanupSelectedRetention };
}

function buildStreamBody(s: LogsState) {
  const body: Record<string, unknown> = {
    name: s.streamName.trim() || `${formatTargetType(s.targetType as TargetType)}日志流`,
    sourceType: sourceTypeForTarget(
      s.targetType as TargetType,
      s.resources.find((r) => r.id === s.targetId) as ManagedResource | undefined,
    ),
  };
  const key = streamTargetBodyKeyByType[s.targetType];
  if (key && s.targetId) body[key] = s.targetId;
  if (s.targetType === 'manual' && s.targetId) body.projectId = s.targetId;
  if (s.sourceKey.trim()) body.sourceKey = s.sourceKey.trim();
  return body;
}

function buildCollectionBody(args: {
  t: LogsTailState;
  selectedStream: LogStream | null;
  isSelectedSlsStream: boolean;
}) {
  const { t, selectedStream, isSelectedSlsStream } = args;
  const body: Record<string, unknown> = {
    dryRun: isSelectedSlsStream ? !t.slsLiveCollect : true,
    queue: t.queueLogCollections,
    tail: 200,
  };
  if (isSelectedSlsStream)
    body.params = {
      query: t.slsQuery.trim() || '*',
      windowMinutes: t.slsWindowMinutes,
      limit: t.slsLimit,
      logstore: selectedStream?.sourceKey || undefined,
      confirmLiveRead: t.slsLiveCollect && t.slsConfirmLiveRead,
    };
  return body;
}

const streamTargetBodyKeyByType: Partial<Record<TargetType, string>> = {
  service: 'applicationServiceId',
  server: 'serverId',
  site: 'siteId',
  resource: 'managedResourceId',
  backup: 'backupPlanId',
  deployment: 'deploymentRunId',
  alert: 'alertEventId',
};
