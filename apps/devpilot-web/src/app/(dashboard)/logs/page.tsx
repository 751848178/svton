'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Project {
  id: string;
  name: string;
}

interface ApplicationServiceItem {
  id: string;
  name: string;
  kind: string;
  status: string;
}

interface ApplicationItem {
  id: string;
  name: string;
  project?: Project | null;
  services: ApplicationServiceItem[];
}

interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

interface Site {
  id: string;
  name: string;
  primaryDomain: string;
  status: string;
}

interface ManagedResource {
  id: string;
  name: string;
  provider: string;
  kind: string;
  status: string;
}

interface BackupPlan {
  id: string;
  name: string;
  status: string;
  lastStatus?: string | null;
}

interface AlertEvent {
  id: string;
  metric: string;
  severity: string;
  status: string;
  summary?: string | null;
}

interface DeploymentRun {
  id: string;
  source: string;
  trigger: string;
  status: string;
  branch?: string | null;
}

interface LogStreamMetadata {
  redaction?: {
    extraKeys?: string[];
    maskEmails?: boolean;
    maskIpAddresses?: boolean;
  };
  slsBackfill?: {
    enabled?: boolean;
    live?: boolean;
    confirmLiveRead?: boolean;
    query?: string;
    windowMinutes?: number;
    limit?: number;
    intervalMinutes?: number;
  };
  serverFollow?: {
    enabled?: boolean;
    live?: boolean;
    confirmLiveRead?: boolean;
    queue?: boolean;
    tail?: number;
    intervalMinutes?: number;
    maxAttempts?: number;
  };
  [key: string]: unknown;
}

interface ServerExecutionJobRef {
  id: string;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

interface LogStream {
  id: string;
  name: string;
  sourceType: string;
  sourceKey?: string | null;
  status: string;
  retentionDays: number;
  lastEntryAt?: string | null;
  lastLevel?: string | null;
  lastMessage?: string | null;
  metadata?: LogStreamMetadata | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; status: string } | null;
  server?: Server | null;
  site?: Site | null;
  managedResource?: ManagedResource | null;
  deploymentRun?: DeploymentRun | null;
  backupPlan?: BackupPlan | null;
  backupRun?: { id: string; backupType: string; status: string; dryRun: boolean } | null;
  alertEvent?: AlertEvent | null;
  _count?: { entries: number };
}

interface LogEntry {
  id: string;
  level: string;
  message: string;
  source?: string | null;
  timestamp: string;
  stream?: { id: string; name: string; sourceType: string; status: string } | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; status: string } | null;
  server?: Server | null;
  site?: Site | null;
  managedResource?: ManagedResource | null;
}

interface LogTailResponse {
  streamId: string;
  limit: number;
  pollAfterMs: number;
  hasMore: boolean;
  cursor?: string | null;
  entries: LogEntry[];
}

type LogStreamEventPayload = Partial<LogTailResponse> & {
  message?: string;
  at?: string;
  sessionId?: string;
  expiresAt?: string;
  maxSessionMs?: number;
  reason?: string;
};

interface LogStreamSession {
  id: string;
  streamId: string;
  actorId: string;
  openedAt: string;
  expiresAt: string;
  maxSessionMs: number;
  pollIntervalMs: number;
  cursor?: string | null;
  lastEventAt: string;
  status: string;
  closeRequestedAt?: string | null;
  closeReason?: string | null;
}

interface LogCollectionRun {
  id: string;
  sourceType: string;
  sourceKey?: string | null;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  tail: number;
  status: string;
  error?: string | null;
  ingestionStatus?: string | null;
  ingestedEntryCount?: number;
  ingestionError?: string | null;
  ingestedAt?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  serverExecutionJobId?: string | null;
  serverExecutionJob?: ServerExecutionJobRef | null;
  stream?: { id: string; name: string; sourceType: string; status: string } | null;
  server?: Server | null;
  managedResource?: ManagedResource | null;
}

interface LogRetentionRun {
  id: string;
  streamId?: string | null;
  dryRun: boolean;
  retentionDays: number;
  cutoffAt: string;
  matchedEntryCount: number;
  deletedEntryCount: number;
  status: string;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  stream?: { id: string; name: string; sourceType: string; status: string; retentionDays: number } | null;
}

interface LogStats {
  windowMinutes: number;
  total: number;
  byLevel: Array<{ level: string; count: number }>;
  warningCount: number;
  errorCount: number;
  fatalCount: number;
}

type TargetType = 'service' | 'server' | 'site' | 'resource' | 'backup' | 'deployment' | 'alert' | 'manual';

const sourceLabels: Record<string, string> = {
  manual: '手动',
  server_executor: 'Server executor',
  docker: 'Docker',
  nginx: 'Nginx/OpenResty',
  sls: 'SLS',
  deployment: '部署',
  backup: '备份',
  alert: '告警',
};

const levelClasses: Record<string, string> = {
  trace: 'bg-gray-100 text-gray-700',
  debug: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  fatal: 'bg-red-100 text-red-700',
};

const runStatusClasses: Record<string, string> = {
  queued: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  running: 'bg-blue-100 text-blue-700',
  blocked: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-700',
};

const streamReconnectDelaysMs = [1000, 2000, 5000, 10000, 30000];
const streamSessionMaxMs = 300000;

export default function LogsPage() {
  const [streams, setStreams] = useState<LogStream[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [collectionRuns, setCollectionRuns] = useState<LogCollectionRun[]>([]);
  const [retentionRuns, setRetentionRuns] = useState<LogRetentionRun[]>([]);
  const [streamSessions, setStreamSessions] = useState<LogStreamSession[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [backupPlans, setBackupPlans] = useState<BackupPlan[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [deploymentRuns, setDeploymentRuns] = useState<DeploymentRun[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('service');
  const [targetId, setTargetId] = useState('');
  const [streamName, setStreamName] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [entryLevel, setEntryLevel] = useState<'info' | 'warn' | 'error'>('info');
  const [entryMessage, setEntryMessage] = useState('');
  const [query, setQuery] = useState('');
  const [slsQuery, setSlsQuery] = useState('*');
  const [slsWindowMinutes, setSlsWindowMinutes] = useState(15);
  const [slsLimit, setSlsLimit] = useState(100);
  const [slsLiveCollect, setSlsLiveCollect] = useState(false);
  const [slsConfirmLiveRead, setSlsConfirmLiveRead] = useState(false);
  const [slsBackfillEnabled, setSlsBackfillEnabled] = useState(false);
  const [slsBackfillLive, setSlsBackfillLive] = useState(false);
  const [slsBackfillConfirmLiveRead, setSlsBackfillConfirmLiveRead] = useState(false);
  const [slsBackfillQuery, setSlsBackfillQuery] = useState('*');
  const [slsBackfillWindowMinutes, setSlsBackfillWindowMinutes] = useState(15);
  const [slsBackfillLimit, setSlsBackfillLimit] = useState(100);
  const [slsBackfillIntervalMinutes, setSlsBackfillIntervalMinutes] = useState(15);
  const [savingSlsBackfill, setSavingSlsBackfill] = useState(false);
  const [serverFollowEnabled, setServerFollowEnabled] = useState(false);
  const [serverFollowLive, setServerFollowLive] = useState(false);
  const [serverFollowConfirmLiveRead, setServerFollowConfirmLiveRead] = useState(false);
  const [serverFollowQueue, setServerFollowQueue] = useState(true);
  const [serverFollowTail, setServerFollowTail] = useState(200);
  const [serverFollowIntervalMinutes, setServerFollowIntervalMinutes] = useState(5);
  const [serverFollowMaxAttempts, setServerFollowMaxAttempts] = useState(3);
  const [savingServerFollow, setSavingServerFollow] = useState(false);
  const [redactionExtraKeys, setRedactionExtraKeys] = useState('');
  const [redactionMaskEmails, setRedactionMaskEmails] = useState(false);
  const [redactionMaskIpAddresses, setRedactionMaskIpAddresses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appending, setAppending] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [savingRedaction, setSavingRedaction] = useState(false);
  const [tailAutoRefresh, setTailAutoRefresh] = useState(false);
  const [tailLoading, setTailLoading] = useState(false);
  const [tailEntries, setTailEntries] = useState<LogEntry[]>([]);
  const [tailCursor, setTailCursor] = useState<string | null>(null);
  const [tailError, setTailError] = useState('');
  const [tailStreaming, setTailStreaming] = useState(false);
  const [tailStreamConnecting, setTailStreamConnecting] = useState(false);
  const [tailStreamLastEventAt, setTailStreamLastEventAt] = useState<string | null>(null);
  const [tailStreamReconnects, setTailStreamReconnects] = useState(0);
  const [tailStreamNextRetryAt, setTailStreamNextRetryAt] = useState<string | null>(null);
  const [tailStreamSessionId, setTailStreamSessionId] = useState<string | null>(null);
  const [tailStreamExpiresAt, setTailStreamExpiresAt] = useState<string | null>(null);
  const [cleaningRetention, setCleaningRetention] = useState<'dry-run' | 'live' | ''>('');
  const [loadingStreamSessions, setLoadingStreamSessions] = useState(false);
  const [closingStreamSessionId, setClosingStreamSessionId] = useState<string | null>(null);
  const [queueLogCollections, setQueueLogCollections] = useState(false);
  const [error, setError] = useState('');
  const tailCursorRef = useRef<string | null>(null);
  const tailStreamSessionIdRef = useRef<string | null>(null);

  const services = useMemo(() => {
    return applications.flatMap((application) => (
      application.services.map((service) => ({
        ...service,
        applicationName: application.name,
        projectName: application.project?.name,
      }))
    ));
  }, [applications]);

  const targetOptions = useMemo(() => {
    if (targetType === 'service') {
      return services.map((service) => ({
        id: service.id,
        label: `${service.applicationName} / ${service.name} · ${service.status}`,
      }));
    }
    if (targetType === 'server') {
      return servers.map((server) => ({ id: server.id, label: `${server.name} · ${server.host} · ${server.status}` }));
    }
    if (targetType === 'site') {
      return sites.map((site) => ({ id: site.id, label: `${site.name} · ${site.primaryDomain} · ${site.status}` }));
    }
    if (targetType === 'resource') {
      return resources.map((resource) => ({
        id: resource.id,
        label: `${resource.name} · ${resource.provider}/${resource.kind} · ${resource.status}`,
      }));
    }
    if (targetType === 'backup') {
      return backupPlans.map((plan) => ({ id: plan.id, label: `${plan.name} · ${plan.lastStatus || plan.status}` }));
    }
    if (targetType === 'deployment') {
      return deploymentRuns.map((run) => ({ id: run.id, label: `${run.trigger} · ${run.branch || run.source} · ${run.status}` }));
    }
    if (targetType === 'alert') {
      return alertEvents.map((event) => ({ id: event.id, label: `${event.metric} · ${event.severity} · ${event.status}` }));
    }
    return projects.map((project) => ({ id: project.id, label: project.name }));
  }, [alertEvents, backupPlans, deploymentRuns, projects, resources, servers, services, sites, targetType]);

  const selectedStream = streams.find((stream) => stream.id === selectedStreamId);
  const isSelectedSlsStream = selectedStream?.sourceType === 'sls';
  const isSelectedServerFollowStream = isServerFollowSourceType(selectedStream?.sourceType);
  const visibleEntries = entries.filter((entry) => (
    (!selectedStreamId || entry.stream?.id === selectedStreamId || entry.id === selectedStreamId)
    && (!query || entry.message.toLowerCase().includes(query.toLowerCase()))
  ));
  const visibleTailEntries = tailEntries.filter((entry) => (
    !query || entry.message.toLowerCase().includes(query.toLowerCase())
  ));
  const isTailMode = tailAutoRefresh || tailStreaming || tailEntries.length > 0;
  const displayedEntries = isTailMode ? visibleTailEntries : visibleEntries;
  const visibleCollectionRuns = collectionRuns.filter((run) => (
    !selectedStreamId || run.stream?.id === selectedStreamId
  ));
  const visibleRetentionRuns = retentionRuns.filter((run) => (
    !selectedStreamId || run.stream?.id === selectedStreamId || run.streamId === selectedStreamId
  ));
  const visibleStreamSessions = streamSessions.filter((session) => (
    !selectedStreamId || session.streamId === selectedStreamId
  ));

  const stats = useMemo(() => ({
    streams: streams.length,
    entries: entries.length,
    errors: entries.filter((entry) => ['error', 'fatal'].includes(entry.level)).length,
    active: streams.filter((stream) => stream.status === 'active').length,
  }), [entries, streams]);

  const refreshStreamSessions = async () => {
    setLoadingStreamSessions(true);
    try {
      const params = selectedStreamId ? { streamId: selectedStreamId } : undefined;
      const sessions = await api.get<LogStreamSession[]>('/logs/stream-sessions', { params });
      setStreamSessions((current) => mergeStreamSessions(current, sessions, selectedStreamId));
    } catch (err) {
      setTailError(err instanceof Error ? err.message : '刷新日志流会话失败');
    } finally {
      setLoadingStreamSessions(false);
    }
  };

  const loadData = async () => {
    setError('');
    try {
      const [streamData, entryData, runData, retentionRunData, sessionData, statsData, projectData, appData, serverData, siteData, resourceData, backupData, alertData, deploymentData] = await Promise.all([
        api.get<LogStream[]>('/logs/streams'),
        api.get<LogEntry[]>('/logs/entries'),
        api.get<LogCollectionRun[]>('/logs/collection-runs'),
        api.get<LogRetentionRun[]>('/logs/retention-runs'),
        api.get<LogStreamSession[]>('/logs/stream-sessions'),
        api.get<LogStats>('/logs/stats'),
        api.get<Project[]>('/projects'),
        api.get<ApplicationItem[]>('/applications'),
        api.get<Server[]>('/servers'),
        api.get<Site[]>('/sites'),
        api.get<ManagedResource[]>('/resource-control/resources'),
        api.get<BackupPlan[]>('/backups/plans'),
        api.get<AlertEvent[]>('/monitoring/alert-events'),
        api.get<DeploymentRun[]>('/deployments/runs'),
      ]);
      setStreams(streamData);
      setEntries(entryData);
      setCollectionRuns(runData);
      setRetentionRuns(retentionRunData);
      setStreamSessions(sessionData);
      setLogStats(statsData);
      setProjects(projectData);
      setApplications(appData);
      setServers(serverData);
      setSites(siteData);
      setResources(resourceData);
      setBackupPlans(backupData);
      setAlertEvents(alertData);
      setDeploymentRuns(deploymentData);
      setSelectedStreamId((current) => current || streamData[0]?.id || '');
      setTargetId((current) => current || appData[0]?.services[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载日志中心数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    tailCursorRef.current = tailCursor;
  }, [tailCursor]);

  useEffect(() => {
    tailStreamSessionIdRef.current = tailStreamSessionId;
  }, [tailStreamSessionId]);

  useEffect(() => {
    setTargetId(targetOptions[0]?.id || '');
  }, [targetOptions]);

  useEffect(() => {
    const redaction = readRedactionMetadata(selectedStream?.metadata);
    setRedactionExtraKeys((redaction.extraKeys || []).join(', '));
    setRedactionMaskEmails(redaction.maskEmails);
    setRedactionMaskIpAddresses(redaction.maskIpAddresses);

    const slsBackfill = readSlsBackfillMetadata(selectedStream?.metadata);
    setSlsBackfillEnabled(slsBackfill.enabled);
    setSlsBackfillLive(slsBackfill.live);
    setSlsBackfillConfirmLiveRead(slsBackfill.confirmLiveRead);
    setSlsBackfillQuery(slsBackfill.query);
    setSlsBackfillWindowMinutes(slsBackfill.windowMinutes);
    setSlsBackfillLimit(slsBackfill.limit);
    setSlsBackfillIntervalMinutes(slsBackfill.intervalMinutes);

    const serverFollow = readServerFollowMetadata(selectedStream?.metadata);
    setServerFollowEnabled(serverFollow.enabled);
    setServerFollowLive(serverFollow.live);
    setServerFollowConfirmLiveRead(serverFollow.confirmLiveRead);
    setServerFollowQueue(serverFollow.queue);
    setServerFollowTail(serverFollow.tail);
    setServerFollowIntervalMinutes(serverFollow.intervalMinutes);
    setServerFollowMaxAttempts(serverFollow.maxAttempts);
  }, [selectedStream?.id, selectedStream?.metadata]);

  useEffect(() => {
    setTailEntries([]);
    setTailCursor(null);
    tailCursorRef.current = null;
    setTailError('');
    setTailStreaming(false);
    setTailStreamConnecting(false);
    setTailStreamLastEventAt(null);
    setTailStreamReconnects(0);
    setTailStreamNextRetryAt(null);
    setTailStreamSessionId(null);
    setTailStreamExpiresAt(null);
    setSlsLiveCollect(false);
    setSlsConfirmLiveRead(false);
  }, [selectedStreamId]);

  useEffect(() => {
    if (!tailAutoRefresh || !selectedStreamId) return;

    let cancelled = false;
    let cursor: string | null = tailCursor;
    const poll = async () => {
      try {
        const response = await loadTailEntries(cursor);
        if (cancelled) return;
        cursor = response.cursor || cursor;
        setTailCursor(response.cursor || null);
        setTailEntries((current) => mergeLogTimeline(current, response.entries));
        setTailError('');
      } catch (err) {
        if (!cancelled) {
          setTailError(err instanceof Error ? err.message : 'Tail 刷新失败');
        }
      }
    };

    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailAutoRefresh, selectedStreamId]);

  useEffect(() => {
    if (!tailStreaming || !selectedStreamId) return;

    const controller = new AbortController();
    let cancelled = false;
    let retryTimer: number | null = null;
    let reconnectAttempt = 0;

    const waitForReconnect = (delayMs: number) => new Promise<void>((resolve) => {
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        resolve();
      }, delayMs);
    });

    const openStream = async () => {
      while (!cancelled && !controller.signal.aborted) {
        const reconnectCursor = tailCursorRef.current;
        const params: Record<string, string> = {
          limit: '100',
          pollIntervalMs: '3000',
          maxSessionMs: String(streamSessionMaxMs),
        };
        if (reconnectCursor) params.cursor = reconnectCursor;

        try {
          setTailStreamConnecting(true);
          const response = await api.stream(`/logs/streams/${selectedStreamId}/events`, {
            params,
            signal: controller.signal,
            headers: reconnectCursor ? { 'Last-Event-ID': reconnectCursor } : undefined,
          });
          if (cancelled) break;
          setTailStreamConnecting(false);
          setTailStreamNextRetryAt(null);
          setTailError('');

          await readSseStream(response, (event, data) => {
            if (cancelled) return;
            const payload = data as LogStreamEventPayload;
            setTailStreamLastEventAt(payload.at || new Date().toISOString());
            if (typeof payload.sessionId === 'string') {
              const isNewSession = payload.sessionId !== tailStreamSessionIdRef.current;
              tailStreamSessionIdRef.current = payload.sessionId;
              setTailStreamSessionId(payload.sessionId);
              if (isNewSession) void refreshStreamSessions();
            }
            if (typeof payload.expiresAt === 'string') {
              setTailStreamExpiresAt(payload.expiresAt);
            }
            if (typeof payload.cursor === 'string') {
              tailCursorRef.current = payload.cursor;
              setTailCursor(payload.cursor);
            }
            if (event === 'entries' && Array.isArray(payload.entries)) {
              setTailEntries((current) => mergeLogTimeline(current, payload.entries as LogEntry[]));
              setTailError('');
            }
            if (event === 'error') {
              setTailError(payload.message || '日志流式 Tail 失败');
            }
            if (event === 'closing') {
              setTailError(payload.reason === 'max_session_duration'
                ? '日志流会话到期，正在续接'
                : '日志流会话关闭，正在续接');
              void refreshStreamSessions();
            }
          });
          if (cancelled || controller.signal.aborted) break;
          throw new Error('实时日志流连接已断开');
        } catch (err) {
          if (cancelled || controller.signal.aborted) break;
          reconnectAttempt += 1;
          const delayMs = getStreamReconnectDelayMs(reconnectAttempt);
          const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
          setTailStreamReconnects(reconnectAttempt);
          setTailStreamConnecting(false);
          setTailStreamNextRetryAt(nextRetryAt);
          setTailError(
            `${err instanceof Error ? err.message : '实时日志流连接失败'}，${Math.ceil(delayMs / 1000)} 秒后重连`,
          );
          await waitForReconnect(delayMs);
          if (!cancelled) {
            setTailStreamConnecting(true);
          }
        }
      }

      if (!cancelled) {
        setTailStreamConnecting(false);
      }
    };

    setTailStreamReconnects(0);
    setTailStreamNextRetryAt(null);
    void openStream();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailStreaming, selectedStreamId]);

  const createStream = async () => {
    if (targetType !== 'manual' && !targetId) {
      alert('请选择日志目标');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: streamName.trim() || `${formatTargetType(targetType)}日志流`,
        sourceType: sourceTypeForTarget(targetType, resources.find((resource) => resource.id === targetId)),
      };
      if (targetType === 'service') body.applicationServiceId = targetId;
      if (targetType === 'server') body.serverId = targetId;
      if (targetType === 'site') body.siteId = targetId;
      if (targetType === 'resource') body.managedResourceId = targetId;
      if (targetType === 'backup') body.backupPlanId = targetId;
      if (targetType === 'deployment') body.deploymentRunId = targetId;
      if (targetType === 'alert') body.alertEventId = targetId;
      if (targetType === 'manual' && targetId) body.projectId = targetId;
      if (sourceKey.trim()) body.sourceKey = sourceKey.trim();

      const stream = await api.post<LogStream>('/logs/streams', body);
      setStreamName('');
      setSourceKey('');
      setSelectedStreamId(stream.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建日志流失败');
    } finally {
      setSaving(false);
    }
  };

  const appendEntry = async () => {
    if (!selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    if (!entryMessage.trim()) {
      alert('请输入日志内容');
      return;
    }

    setAppending(true);
    setError('');
    try {
      await api.post(`/logs/streams/${selectedStreamId}/entries`, {
        level: entryLevel,
        message: entryMessage,
        source: 'manual',
      });
      setEntryMessage('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加日志失败');
    } finally {
      setAppending(false);
    }
  };

  const collectSelectedStream = async () => {
    if (!selectedStreamId) {
      alert('请选择日志流');
      return;
    }

    setCollecting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        dryRun: isSelectedSlsStream ? !slsLiveCollect : true,
        queue: queueLogCollections,
        tail: 200,
      };

      if (isSelectedSlsStream) {
        body.params = {
          query: slsQuery.trim() || '*',
          windowMinutes: slsWindowMinutes,
          limit: slsLimit,
          logstore: selectedStream?.sourceKey || undefined,
          confirmLiveRead: slsLiveCollect && slsConfirmLiveRead,
        };
      }

      await api.post(`/logs/streams/${selectedStreamId}/collect`, body);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成采集计划失败');
    } finally {
      setCollecting(false);
    }
  };

  const cleanupSelectedRetention = async (dryRun: boolean) => {
    if (!selectedStreamId) {
      alert('请选择日志流');
      return;
    }

    setCleaningRetention(dryRun ? 'dry-run' : 'live');
    setError('');
    try {
      await api.post(`/logs/streams/${selectedStreamId}/retention/cleanup`, { dryRun });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '日志保留清理失败');
    } finally {
      setCleaningRetention('');
    }
  };

  const loadTailEntries = (cursor?: string | null) => {
    const params: Record<string, string> = { limit: '100' };
    if (cursor) params.cursor = cursor;
    return api.get<LogTailResponse>(`/logs/streams/${selectedStreamId}/tail`, { params });
  };

  const refreshTailEntries = async (reset: boolean) => {
    if (!selectedStreamId) {
      alert('请选择日志流');
      return;
    }

    setTailLoading(true);
    setTailError('');
    try {
      const response = await loadTailEntries(reset ? null : tailCursor);
      setTailCursor(response.cursor || null);
      setTailEntries((current) => mergeLogTimeline(reset ? [] : current, response.entries));
    } catch (err) {
      setTailError(err instanceof Error ? err.message : 'Tail 刷新失败');
    } finally {
      setTailLoading(false);
    }
  };

  const closeStreamSession = async (sessionId: string) => {
    setClosingStreamSessionId(sessionId);
    setTailError('');
    try {
      await api.post(`/logs/stream-sessions/${sessionId}/close`);
      if (sessionId === tailStreamSessionId) {
        setTailStreaming(false);
        setTailStreamConnecting(false);
        setTailStreamSessionId(null);
        setTailStreamExpiresAt(null);
      }
      await refreshStreamSessions();
    } catch (err) {
      setTailError(err instanceof Error ? err.message : '关闭日志流会话失败');
    } finally {
      setClosingStreamSessionId(null);
    }
  };

  const saveRedactionPolicy = async () => {
    if (!selectedStream) {
      alert('请选择日志流');
      return;
    }

    setSavingRedaction(true);
    setError('');
    try {
      await api.put(`/logs/streams/${selectedStream.id}`, {
        metadata: mergeRedactionMetadata(selectedStream.metadata, {
          extraKeys: parseRedactionKeys(redactionExtraKeys),
          maskEmails: redactionMaskEmails,
          maskIpAddresses: redactionMaskIpAddresses,
        }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存脱敏策略失败');
    } finally {
      setSavingRedaction(false);
    }
  };

  const saveSlsBackfillPolicy = async () => {
    if (!selectedStream) {
      alert('请选择日志流');
      return;
    }

    setSavingSlsBackfill(true);
    setError('');
    try {
      await api.put(`/logs/streams/${selectedStream.id}`, {
        metadata: mergeSlsBackfillMetadata(selectedStream.metadata, {
          enabled: slsBackfillEnabled,
          live: slsBackfillLive,
          confirmLiveRead: slsBackfillLive && slsBackfillConfirmLiveRead,
          query: slsBackfillQuery.trim() || '*',
          windowMinutes: slsBackfillWindowMinutes,
          limit: slsBackfillLimit,
          intervalMinutes: slsBackfillIntervalMinutes,
        }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 SLS 回填失败');
    } finally {
      setSavingSlsBackfill(false);
    }
  };

  const saveServerFollowPolicy = async () => {
    if (!selectedStream) {
      alert('请选择日志流');
      return;
    }

    setSavingServerFollow(true);
    setError('');
    try {
      await api.put(`/logs/streams/${selectedStream.id}`, {
        metadata: mergeServerFollowMetadata(selectedStream.metadata, {
          enabled: serverFollowEnabled,
          live: serverFollowLive,
          confirmLiveRead: serverFollowLive && serverFollowConfirmLiveRead,
          queue: serverFollowQueue,
          tail: serverFollowTail,
          intervalMinutes: serverFollowIntervalMinutes,
          maxAttempts: serverFollowMaxAttempts,
        }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 Server follow 失败');
    } finally {
      setSavingServerFollow(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">日志中心</h1>
          <p className="mt-1 text-muted-foreground">
            归档和检索项目、环境、服务、站点、资源、部署、备份和告警日志
          </p>
        </div>
        <button onClick={loadData} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="日志流" value={stats.streams} />
        <Metric label="启用中" value={stats.active} />
        <Metric label="日志条目" value={stats.entries} />
        <Metric label="错误日志" value={stats.errors} />
      </div>

      {logStats && (
        <div className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">近 {logStats.windowMinutes} 分钟日志</h2>
              <div className="mt-1 text-sm text-muted-foreground">
                总计 {logStats.total} 条 · warn {logStats.warningCount} · error {logStats.errorCount} · fatal {logStats.fatalCount}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {logStats.byLevel.length === 0 ? (
                <Badge className="bg-gray-100 text-gray-700">暂无日志</Badge>
              ) : logStats.byLevel.map((item) => (
                <Badge key={item.level} className={levelClasses[item.level] || 'bg-gray-100 text-gray-700'}>
                  {`${item.level} ${item.count}`}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border p-4">
        <div className="grid gap-4 xl:grid-cols-[160px_minmax(0,1fr)_minmax(160px,0.55fr)_minmax(160px,0.55fr)_auto]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">目标类型</span>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as TargetType)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="service">服务</option>
              <option value="server">服务器</option>
              <option value="site">站点</option>
              <option value="resource">资源</option>
              <option value="backup">备份计划</option>
              <option value="deployment">部署运行</option>
              <option value="alert">告警事件</option>
              <option value="manual">项目手动</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">目标</span>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">请选择目标</option>
              {targetOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">名称</span>
            <input
              value={streamName}
              onChange={(event) => setStreamName(event.target.value)}
              placeholder={`${formatTargetType(targetType)}日志流`}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Source key</span>
            <input
              value={sourceKey}
              onChange={(event) => setSourceKey(event.target.value)}
              placeholder={sourceKeyPlaceholder(targetType)}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={createStream}
              disabled={saving || (targetType !== 'manual' && !targetId)}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {saving ? '创建中...' : '创建日志流'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">加载中...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-4">
            {streams.length === 0 ? (
              <div className="rounded-lg border py-12 text-center">
                <h3 className="text-lg font-medium">暂无日志流</h3>
                <p className="mt-2 text-muted-foreground">
                  创建日志流后可以手动追加日志，后续采集器也会写入这里
                </p>
              </div>
            ) : streams.map((stream) => (
              <button
                key={stream.id}
                onClick={() => setSelectedStreamId(stream.id)}
                className={`block w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/40 ${
                  selectedStreamId === stream.id ? 'border-primary bg-muted/30' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{stream.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {sourceLabels[stream.sourceType] || stream.sourceType} · {stream._count?.entries || 0} 条
                    </div>
                  </div>
                  <Badge className={stream.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {stream.status === 'active' ? '启用' : '归档'}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {formatStreamTarget(stream)}
                </div>
                {stream.lastMessage && (
                  <div className="mt-2 truncate text-xs text-muted-foreground">
                    {stream.lastLevel || 'info'} · {stream.lastMessage}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{selectedStream?.name || '日志条目'}</h2>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedStream ? formatStreamTarget(selectedStream) : '选择一个日志流查看条目'}
                  </div>
                </div>
                <div className="flex w-full flex-wrap gap-2 md:w-auto">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索日志内容"
                    className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm md:w-56"
                  />
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={queueLogCollections}
                      onChange={(event) => setQueueLogCollections(event.target.checked)}
                    />
                    <span>日志采集加入队列</span>
                  </label>
                  <button
                    onClick={collectSelectedStream}
                    disabled={collecting || !selectedStreamId || (isSelectedSlsStream && slsLiveCollect && !slsConfirmLiveRead)}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    {collecting
                      ? (slsLiveCollect ? '拉取中...' : (queueLogCollections ? '入队中...' : '生成中...'))
                      : (slsLiveCollect ? 'Live 拉取' : (queueLogCollections ? '计划入队' : '生成采集计划'))}
                  </button>
                  <button
                    onClick={() => refreshTailEntries(true)}
                    disabled={tailLoading || !selectedStreamId}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    {tailLoading ? 'Tail 中...' : 'Tail'}
                  </button>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={tailAutoRefresh}
                      onChange={(event) => {
                        setTailAutoRefresh(event.target.checked);
                        if (event.target.checked) {
                          setTailStreaming(false);
                          setTailStreamConnecting(false);
                          setTailStreamReconnects(0);
                          setTailStreamNextRetryAt(null);
                          setTailStreamSessionId(null);
                          setTailStreamExpiresAt(null);
                        }
                      }}
                    />
                    <span>自动 Tail</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={tailStreaming}
                      disabled={!selectedStreamId}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setTailStreaming(enabled);
                        if (enabled) {
                          setTailAutoRefresh(false);
                          setTailStreamReconnects(0);
                          setTailStreamNextRetryAt(null);
                          setTailStreamSessionId(null);
                          setTailStreamExpiresAt(null);
                        } else {
                          setTailStreamConnecting(false);
                          setTailStreamNextRetryAt(null);
                          setTailStreamSessionId(null);
                          setTailStreamExpiresAt(null);
                        }
                      }}
                    />
                    <span>{tailStreamConnecting ? '连接中' : '实时流'}</span>
                  </label>
                  <button
                    onClick={refreshStreamSessions}
                    disabled={loadingStreamSessions || !selectedStreamId}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    {loadingStreamSessions ? '刷新中...' : '刷新会话'}
                  </button>
                  {isTailMode && (
                    <button
                      onClick={() => {
                        setTailAutoRefresh(false);
                        setTailStreaming(false);
                        setTailStreamConnecting(false);
                        setTailEntries([]);
                        setTailCursor(null);
                        tailCursorRef.current = null;
                        setTailError('');
                        setTailStreamLastEventAt(null);
                        setTailStreamReconnects(0);
                        setTailStreamNextRetryAt(null);
                        setTailStreamSessionId(null);
                        setTailStreamExpiresAt(null);
                      }}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
                    >
                      清空 Tail
                    </button>
                  )}
                </div>
              </div>
              {(isTailMode || tailError) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {isTailMode && (
                    <span>
                      Tail {tailEntries.length} 条
                    </span>
                  )}
                  {tailCursor && <span>cursor 已更新</span>}
                  {tailStreaming && (
                    <span>
                      {tailStreamConnecting
                        ? (tailStreamReconnects > 0 ? '实时流重连中' : '实时流连接中')
                        : '实时流已连接'}
                    </span>
                  )}
                  {tailStreamSessionId && <span>会话 {shortId(tailStreamSessionId)}</span>}
                  {tailStreamExpiresAt && <span>到期 {formatDate(tailStreamExpiresAt)}</span>}
                  {tailStreamReconnects > 0 && <span>已重连 {tailStreamReconnects} 次</span>}
                  {tailStreamNextRetryAt && <span>下次重连 {formatDate(tailStreamNextRetryAt)}</span>}
                  {tailStreamLastEventAt && <span>最近事件 {formatDate(tailStreamLastEventAt)}</span>}
                  {tailError && <span className="text-red-600">{tailError}</span>}
                </div>
              )}
              {selectedStreamId && (visibleStreamSessions.length > 0 || loadingStreamSessions) && (
                <div className="mt-3 rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">活跃会话</span>
                    <Badge className="bg-blue-100 text-blue-700">{visibleStreamSessions.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {visibleStreamSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">
                            {shortId(session.id)} · {formatSessionStatus(session.status)}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            打开 {formatDate(session.openedAt)} · 到期 {formatDate(session.expiresAt)} · 最近 {formatDate(session.lastEventAt)}
                          </div>
                        </div>
                        <button
                          onClick={() => closeStreamSession(session.id)}
                          disabled={closingStreamSessionId === session.id}
                          className="rounded-md border px-2 py-1 hover:bg-accent disabled:opacity-50"
                        >
                          {closingStreamSessionId === session.id ? '关闭中...' : '关闭'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedStream && isSelectedServerFollowStream && (
                <div className="mt-4 border-t pt-4">
                  <div className="grid gap-3 md:grid-cols-[120px_120px_120px]">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Follow Tail</span>
                      <input
                        type="number"
                        min={1}
                        max={5000}
                        value={serverFollowTail}
                        onChange={(event) => setServerFollowTail(Number(event.target.value) || 200)}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">间隔分钟</span>
                      <input
                        type="number"
                        min={1}
                        max={10080}
                        value={serverFollowIntervalMinutes}
                        onChange={(event) => setServerFollowIntervalMinutes(Number(event.target.value) || 5)}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">重试次数</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={serverFollowMaxAttempts}
                        onChange={(event) => setServerFollowMaxAttempts(Number(event.target.value) || 3)}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={serverFollowEnabled}
                        onChange={(event) => setServerFollowEnabled(event.target.checked)}
                      />
                      <span>定时 Follow</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={serverFollowQueue}
                        onChange={(event) => setServerFollowQueue(event.target.checked)}
                      />
                      <span>入队执行</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={serverFollowLive}
                        onChange={(event) => {
                          setServerFollowLive(event.target.checked);
                          if (!event.target.checked) setServerFollowConfirmLiveRead(false);
                        }}
                      />
                      <span>Follow live</span>
                    </label>
                    {serverFollowLive && (
                      <label className="flex items-center gap-2 rounded-md border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
                        <input
                          type="checkbox"
                          checked={serverFollowConfirmLiveRead}
                          onChange={(event) => setServerFollowConfirmLiveRead(event.target.checked)}
                        />
                        <span>确认读取线上日志</span>
                      </label>
                    )}
                    <button
                      onClick={saveServerFollowPolicy}
                      disabled={savingServerFollow || !selectedStreamId}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                    >
                      {savingServerFollow ? '保存中...' : '保存 Follow'}
                    </button>
                  </div>
                </div>
              )}
              {isSelectedSlsStream && (
                <div className="mt-4 border-t pt-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_120px]">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">SLS query</span>
                      <input
                        value={slsQuery}
                        onChange={(event) => setSlsQuery(event.target.value)}
                        placeholder="*"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">窗口分钟</span>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={slsWindowMinutes}
                        onChange={(event) => setSlsWindowMinutes(Number(event.target.value) || 15)}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Limit</span>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={slsLimit}
                        onChange={(event) => setSlsLimit(Number(event.target.value) || 100)}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={slsLiveCollect}
                        onChange={(event) => {
                          setSlsLiveCollect(event.target.checked);
                          if (!event.target.checked) setSlsConfirmLiveRead(false);
                        }}
                      />
                      <span>Live 读取 SLS</span>
                    </label>
                    {slsLiveCollect && (
                      <label className="flex items-center gap-2 rounded-md border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
                        <input
                          type="checkbox"
                          checked={slsConfirmLiveRead}
                          onChange={(event) => setSlsConfirmLiveRead(event.target.checked)}
                        />
                        <span>确认读取线上日志</span>
                      </label>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    logstore {selectedStream?.sourceKey || '-'} · {slsLiveCollect ? 'live' : 'dry-run'}
                  </div>
                  <div className="mt-4 border-t pt-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px]">
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">回填 query</span>
                        <input
                          value={slsBackfillQuery}
                          onChange={(event) => setSlsBackfillQuery(event.target.value)}
                          placeholder="*"
                          className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">回填窗口</span>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={slsBackfillWindowMinutes}
                          onChange={(event) => setSlsBackfillWindowMinutes(Number(event.target.value) || 15)}
                          className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">回填 Limit</span>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={slsBackfillLimit}
                          onChange={(event) => setSlsBackfillLimit(Number(event.target.value) || 100)}
                          className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">间隔分钟</span>
                        <input
                          type="number"
                          min={1}
                          max={10080}
                          value={slsBackfillIntervalMinutes}
                          onChange={(event) => setSlsBackfillIntervalMinutes(Number(event.target.value) || 15)}
                          className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={slsBackfillEnabled}
                          onChange={(event) => setSlsBackfillEnabled(event.target.checked)}
                        />
                        <span>定时回填</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={slsBackfillLive}
                          onChange={(event) => {
                            setSlsBackfillLive(event.target.checked);
                            if (!event.target.checked) setSlsBackfillConfirmLiveRead(false);
                          }}
                        />
                        <span>回填 live</span>
                      </label>
                      {slsBackfillLive && (
                        <label className="flex items-center gap-2 rounded-md border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
                          <input
                            type="checkbox"
                            checked={slsBackfillConfirmLiveRead}
                            onChange={(event) => setSlsBackfillConfirmLiveRead(event.target.checked)}
                          />
                          <span>确认定时读取</span>
                        </label>
                      )}
                      <button
                        onClick={saveSlsBackfillPolicy}
                        disabled={savingSlsBackfill || !selectedStreamId}
                        className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                      >
                        {savingSlsBackfill ? '保存中...' : '保存回填'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto]">
                <select
                  value={entryLevel}
                  onChange={(event) => setEntryLevel(event.target.value as 'info' | 'warn' | 'error')}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
                <input
                  value={entryMessage}
                  onChange={(event) => setEntryMessage(event.target.value)}
                  placeholder="追加一条日志"
                  className="rounded-md border px-3 py-2 text-sm"
                />
                <button
                  onClick={appendEntry}
                  disabled={appending || !selectedStreamId}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                >
                  {appending ? '追加中...' : '追加'}
                </button>
              </div>
              {selectedStream && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-0 flex-1 text-sm">
                      <span className="mb-1 block font-medium">脱敏 key</span>
                      <input
                        value={redactionExtraKeys}
                        onChange={(event) => setRedactionExtraKeys(event.target.value)}
                        placeholder="session_id, api_key"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={redactionMaskEmails}
                        onChange={(event) => setRedactionMaskEmails(event.target.checked)}
                      />
                      <span>邮箱</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={redactionMaskIpAddresses}
                        onChange={(event) => setRedactionMaskIpAddresses(event.target.checked)}
                      />
                      <span>IP</span>
                    </label>
                    <button
                      onClick={saveRedactionPolicy}
                      disabled={savingRedaction}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                    >
                      {savingRedaction ? '保存中...' : '保存脱敏'}
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-4 border-t pt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">保留策略</h3>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selectedStream ? `保留 ${selectedStream.retentionDays} 天` : '选择日志流后可执行保留清理'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => cleanupSelectedRetention(true)}
                      disabled={Boolean(cleaningRetention) || !selectedStreamId}
                      className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      {cleaningRetention === 'dry-run' ? '计算中...' : 'dry-run'}
                    </button>
                    <button
                      onClick={() => cleanupSelectedRetention(false)}
                      disabled={Boolean(cleaningRetention) || !selectedStreamId}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {cleaningRetention === 'live' ? '清理中...' : 'live 清理'}
                    </button>
                  </div>
                </div>
                <div className="mt-3 divide-y">
                  {visibleRetentionRuns.length === 0 ? (
                    <div className="py-2 text-sm text-muted-foreground">暂无保留清理运行</div>
                  ) : visibleRetentionRuns.slice(0, 3).map((run) => (
                    <div key={run.id} className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={runStatusClasses[run.status] || 'bg-gray-100 text-gray-700'}>
                          {formatRunStatus(run.status)}
                        </Badge>
                        {run.dryRun && <Badge className="bg-blue-100 text-blue-700">dry-run</Badge>}
                        <span className="text-xs text-muted-foreground">
                          匹配 {run.matchedEntryCount} · 删除 {run.deletedEntryCount}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          截止 {formatDate(run.cutoffAt)}
                        </span>
                      </div>
                      {run.error && (
                        <div className="mt-1 text-xs text-red-600">{run.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">最近采集运行</h3>
                  <span className="text-xs text-muted-foreground">{visibleCollectionRuns.length} 次</span>
                </div>
                {visibleCollectionRuns.length === 0 ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    暂无采集运行
                  </div>
                ) : (
                  <div className="mt-3 divide-y">
                    {visibleCollectionRuns.slice(0, 5).map((run) => (
                      <div key={run.id} className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={runStatusClasses[run.status] || 'bg-gray-100 text-gray-700'}>
                            {formatRunStatus(run.status)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {run.executorKey}/{run.adapterKey}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            tail {run.tail}
                          </span>
                          {run.ingestionStatus && (
                            <Badge className={runStatusClasses[run.ingestionStatus] || 'bg-gray-100 text-gray-700'}>
                              {`入库 ${formatIngestionStatus(run.ingestionStatus)}`}
                            </Badge>
                          )}
                          {run.ingestedEntryCount ? (
                            <span className="text-xs text-muted-foreground">
                              {run.ingestedEntryCount} 条
                            </span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(run.startedAt)}
                          </span>
                        </div>
                        {run.serverExecutionJob && (
                          <div className="mt-1 text-xs">
                            <Link href="/execution-governance" className="text-primary hover:underline">
                              Job {run.serverExecutionJob.id.slice(0, 8)} · {formatRunStatus(run.serverExecutionJob.status)}
                            </Link>
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatRunTarget(run)}
                        </div>
                        {run.error && (
                          <div className="mt-1 text-xs text-red-600">
                            {run.error}
                          </div>
                        )}
                        {run.ingestionError && (
                          <div className="mt-1 text-xs text-red-600">
                            {run.ingestionError}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              {displayedEntries.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {isTailMode ? '暂无 Tail 日志' : '暂无日志条目'}
                </div>
              ) : (
                <div className="divide-y">
                  {displayedEntries.slice(0, 100).map((entry) => (
                    <div key={entry.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={levelClasses[entry.level] || 'bg-gray-100 text-gray-700'}>
                          {entry.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</span>
                        <span className="text-xs text-muted-foreground">{entry.source || entry.stream?.sourceType || '-'}</span>
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-6">
                        {entry.message}
                      </pre>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {formatEntryTarget(entry)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Badge({ children, className }: { children: string | number; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function formatTargetType(targetType: TargetType) {
  const labels: Record<TargetType, string> = {
    service: '服务',
    server: '服务器',
    site: '站点',
    resource: '资源',
    backup: '备份',
    deployment: '部署',
    alert: '告警',
    manual: '项目',
  };
  return labels[targetType];
}

function sourceTypeForTarget(targetType: TargetType, resource?: ManagedResource) {
  if (targetType === 'resource' && (resource?.provider === 'aliyun-sls' || resource?.kind === 'log_service')) {
    return 'sls';
  }

  const mapping: Record<TargetType, string> = {
    service: 'docker',
    server: 'server_executor',
    site: 'nginx',
    resource: 'manual',
    backup: 'backup',
    deployment: 'deployment',
    alert: 'alert',
    manual: 'manual',
  };
  return mapping[targetType];
}

function readSlsBackfillMetadata(metadata?: LogStreamMetadata | null) {
  const raw = metadata?.slsBackfill || {};
  return {
    enabled: raw.enabled === true,
    live: raw.live === true,
    confirmLiveRead: raw.confirmLiveRead === true,
    query: typeof raw.query === 'string' && raw.query.trim() ? raw.query : '*',
    windowMinutes: clampNumber(raw.windowMinutes, 15, 1, 1440),
    limit: clampNumber(raw.limit, 100, 1, 1000),
    intervalMinutes: clampNumber(raw.intervalMinutes, 15, 1, 10080),
  };
}

function readServerFollowMetadata(metadata?: LogStreamMetadata | null) {
  const raw = metadata?.serverFollow || {};
  return {
    enabled: raw.enabled === true,
    live: raw.live === true,
    confirmLiveRead: raw.confirmLiveRead === true,
    queue: raw.queue !== false,
    tail: clampNumber(raw.tail, 200, 1, 5000),
    intervalMinutes: clampNumber(raw.intervalMinutes, 5, 1, 10080),
    maxAttempts: clampNumber(raw.maxAttempts, 3, 1, 10),
  };
}

function isServerFollowSourceType(sourceType?: string | null) {
  return sourceType === 'docker' || sourceType === 'nginx' || sourceType === 'server_executor';
}

function sourceKeyPlaceholder(targetType: TargetType) {
  const placeholders: Record<TargetType, string> = {
    service: '容器名或 compose 服务名',
    server: '/var/log/app/app.log',
    site: 'access.log 或 error.log',
    resource: 'logstore / 实例名',
    backup: '备份任务 key',
    deployment: '构建或部署阶段',
    alert: '告警来源',
    manual: '可选',
  };
  return placeholders[targetType];
}

function readRedactionMetadata(metadata?: LogStreamMetadata | null) {
  return {
    extraKeys: Array.isArray(metadata?.redaction?.extraKeys)
      ? metadata.redaction.extraKeys.filter((item): item is string => typeof item === 'string')
      : [],
    maskEmails: metadata?.redaction?.maskEmails === true,
    maskIpAddresses: metadata?.redaction?.maskIpAddresses === true,
  };
}

function parseRedactionKeys(value: string) {
  return Array.from(new Set(value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^[a-zA-Z0-9_.:-]{1,64}$/.test(item))))
    .slice(0, 30);
}

function mergeRedactionMetadata(
  metadata: LogStreamMetadata | null | undefined,
  redaction: { extraKeys: string[]; maskEmails: boolean; maskIpAddresses: boolean },
): LogStreamMetadata {
  return {
    ...(metadata || {}),
    redaction,
  };
}

function mergeSlsBackfillMetadata(
  metadata: LogStreamMetadata | null | undefined,
  slsBackfill: {
    enabled: boolean;
    live: boolean;
    confirmLiveRead: boolean;
    query: string;
    windowMinutes: number;
    limit: number;
    intervalMinutes: number;
  },
): LogStreamMetadata {
  return {
    ...(metadata || {}),
    slsBackfill: {
      enabled: slsBackfill.enabled,
      live: slsBackfill.live,
      confirmLiveRead: slsBackfill.confirmLiveRead,
      query: slsBackfill.query,
      windowMinutes: clampNumber(slsBackfill.windowMinutes, 15, 1, 1440),
      limit: clampNumber(slsBackfill.limit, 100, 1, 1000),
      intervalMinutes: clampNumber(slsBackfill.intervalMinutes, 15, 1, 10080),
    },
  };
}

function mergeServerFollowMetadata(
  metadata: LogStreamMetadata | null | undefined,
  serverFollow: {
    enabled: boolean;
    live: boolean;
    confirmLiveRead: boolean;
    queue: boolean;
    tail: number;
    intervalMinutes: number;
    maxAttempts: number;
  },
): LogStreamMetadata {
  return {
    ...(metadata || {}),
    serverFollow: {
      enabled: serverFollow.enabled,
      live: serverFollow.live,
      confirmLiveRead: serverFollow.confirmLiveRead,
      queue: serverFollow.queue,
      tail: clampNumber(serverFollow.tail, 200, 1, 5000),
      intervalMinutes: clampNumber(serverFollow.intervalMinutes, 5, 1, 10080),
      maxAttempts: clampNumber(serverFollow.maxAttempts, 3, 1, 10),
    },
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

async function readSseStream(
  response: Response,
  onEvent: (event: string, data: Record<string, unknown>) => void,
) {
  if (!response.body) {
    throw new Error('浏览器不支持日志流读取');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = findSseBoundary(buffer);
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      const separatorLength = buffer.startsWith('\r\n\r\n', boundary) ? 4 : 2;
      buffer = buffer.slice(boundary + separatorLength);
      parseSseFrame(frame, onEvent);
      boundary = findSseBoundary(buffer);
    }
  }
}

function findSseBoundary(buffer: string) {
  const lfBoundary = buffer.indexOf('\n\n');
  const crlfBoundary = buffer.indexOf('\r\n\r\n');
  if (lfBoundary < 0) return crlfBoundary;
  if (crlfBoundary < 0) return lfBoundary;
  return Math.min(lfBoundary, crlfBoundary);
}

function getStreamReconnectDelayMs(attempt: number) {
  const index = Math.max(0, Math.min(attempt - 1, streamReconnectDelaysMs.length - 1));
  return streamReconnectDelaysMs[index];
}

function parseSseFrame(
  frame: string,
  onEvent: (event: string, data: Record<string, unknown>) => void,
) {
  let event = 'message';
  const dataLines: string[] = [];
  frame.split(/\r?\n/).forEach((line) => {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim() || 'message';
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  });
  if (dataLines.length === 0) return;

  try {
    const data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
    onEvent(event, data);
  } catch {
    onEvent(event, { message: dataLines.join('\n') });
  }
}

function mergeLogTimeline(current: LogEntry[], incoming: LogEntry[]) {
  const entriesById = new Map<string, LogEntry>();
  current.forEach((entry) => entriesById.set(entry.id, entry));
  incoming.forEach((entry) => entriesById.set(entry.id, entry));
  return Array.from(entriesById.values())
    .sort((left, right) => (
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
      || left.id.localeCompare(right.id)
    ))
    .slice(-200);
}

function mergeStreamSessions(
  current: LogStreamSession[],
  incoming: LogStreamSession[],
  streamId?: string,
) {
  const sessionsById = new Map<string, LogStreamSession>();
  current
    .filter((session) => !streamId || session.streamId !== streamId)
    .forEach((session) => sessionsById.set(session.id, session));
  incoming.forEach((session) => sessionsById.set(session.id, session));
  return Array.from(sessionsById.values())
    .sort((left, right) => new Date(right.lastEventAt).getTime() - new Date(left.lastEventAt).getTime());
}

function formatStreamTarget(stream: LogStream) {
  return (
    stream.applicationService?.name ||
    stream.server?.name ||
    stream.site?.name ||
    stream.managedResource?.name ||
    stream.backupPlan?.name ||
    stream.backupRun?.id ||
    stream.alertEvent?.metric ||
    stream.deploymentRun?.id ||
    stream.project?.name ||
    '未绑定目标'
  );
}

function formatEntryTarget(entry: LogEntry) {
  return (
    entry.applicationService?.name ||
    entry.server?.name ||
    entry.site?.name ||
    entry.managedResource?.name ||
    entry.project?.name ||
    entry.stream?.name ||
    '-'
  );
}

function formatRunTarget(run: LogCollectionRun) {
  return (
    run.stream?.name ||
    run.server?.name ||
    run.managedResource?.name ||
    run.sourceKey ||
    run.sourceType
  );
}

function formatRunStatus(status: string) {
  const labels: Record<string, string> = {
    queued: '已入队',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    blocked: '已阻断',
    cancelled: '已取消',
  };
  return labels[status] || status;
}

function formatSessionStatus(status: string) {
  const labels: Record<string, string> = {
    open: '在线',
    closing: '关闭中',
  };
  return labels[status] || status;
}

function formatIngestionStatus(status: string) {
  const labels: Record<string, string> = {
    completed: '完成',
    skipped: '跳过',
    failed: '失败',
    pending: '等待',
  };
  return labels[status] || status;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.slice(0, 8);
}
