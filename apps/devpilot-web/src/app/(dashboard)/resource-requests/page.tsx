'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type ResourceFieldType = 'text' | 'number' | 'password' | 'textarea' | 'select' | 'checkbox';
type ResourceFieldValue = string | boolean;

interface ResourceFieldOption {
  label: string;
  value: string;
}

interface ResourceField {
  key: string;
  label: string;
  type: ResourceFieldType;
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  options?: ResourceFieldOption[];
  sensitive?: boolean;
}

interface ResourceRequestSchema {
  fields?: ResourceField[];
}

interface ResourceType {
  id: string;
  key: string;
  name: string;
  category?: string;
  requestSchema?: ResourceRequestSchema;
  deliverySchema?: ResourceRequestSchema;
  envTemplate?: string;
  provisioningMode?: string;
}

interface ProvisioningResult {
  mode?: string;
  status?: string;
  reason?: string;
  boundary?: string;
  provisioningRunId?: string;
  replayOfRunId?: string;
  providerRunId?: string;
  attempt?: number;
  maxAttempts?: number;
}

interface Project {
  id: string;
  name: string;
}

interface ResourceRequest {
  id: string;
  title: string;
  environment?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'canceled';
  createdAt: string;
  resourceType?: ResourceType;
  project?: Project;
  requester?: { id: string; name: string | null; email: string };
  instance?: { id: string; name: string; status: string };
  result?: { provisioning?: ProvisioningResult };
}

interface ResourceProvisioningRun {
  id: string;
  mode?: string;
  trigger?: string;
  boundary?: string;
  executorKey?: string;
  adapterKey?: string;
  authAdapterKey?: string;
  replayOfRunId?: string;
  replayOf?: { id: string; status?: string; trigger?: string; providerRunId?: string; startedAt?: string };
  replayAttemptsCount?: number;
  idempotencyKey?: string;
  providerRunId?: string;
  status?: string;
  queueMode?: string;
  attempt?: number;
  maxAttempts?: number;
  retryable?: boolean;
  autoRetry?: boolean;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  queuedAt?: string;
  availableAt?: string;
  lockedAt?: string;
  lockOwner?: string;
  finishedAt?: string;
  recoveredAt?: string;
  recoveryReason?: string;
  recoveryCount?: number;
  actor?: { id: string; name: string | null; email: string };
  resourceType?: { id: string; key: string; name: string };
}

interface ResourceProvisioningRunSupervisor {
  generatedAt: string;
  staleAfterSeconds: number;
  staleBefore: string;
  scheduler: {
    autoRetryEnabled: boolean;
    staleRecoveryEnabled: boolean;
    queueingEnabled?: boolean;
    intervalSeconds: number;
  };
  counts: {
    queued: number;
    running: number;
    staleRunning: number;
    planned: number;
    blocked: number;
    failed: number;
    completed: number;
  };
  samples: {
    queued: ResourceProvisioningRun[];
    staleRunning: ResourceProvisioningRun[];
    recentProblems: ResourceProvisioningRun[];
  };
}

const statusLabels: Record<ResourceRequest['status'], string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  completed: '已交付',
  canceled: '已取消',
};

function getSchemaFields(schema?: ResourceRequestSchema): ResourceField[] {
  const fields = schema?.fields;
  return Array.isArray(fields) ? fields.filter((field) => Boolean(field?.key && field?.label)) : [];
}

function getResourceFields(resourceType?: ResourceType): ResourceField[] {
  return getSchemaFields(resourceType?.requestSchema);
}

function getFieldDefaultValue(field: ResourceField): ResourceFieldValue {
  if (field.type === 'checkbox') {
    return Boolean(field.default);
  }
  if (field.default === undefined || field.default === null) {
    return '';
  }
  return String(field.default);
}

function buildInitialValuesFromFields(fields: ResourceField[]): Record<string, ResourceFieldValue> {
  return fields.reduce<Record<string, ResourceFieldValue>>((acc, field) => {
    acc[field.key] = getFieldDefaultValue(field);
    return acc;
  }, {});
}

function buildInitialFieldValues(resourceType?: ResourceType): Record<string, ResourceFieldValue> {
  return buildInitialValuesFromFields(getResourceFields(resourceType));
}

function buildPayloadFromFields(
  fields: ResourceField[],
  values: Record<string, ResourceFieldValue>,
  includeField: (field: ResourceField) => boolean = () => true,
): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    if (!includeField(field)) {
      return acc;
    }

    const value = values[field.key];

    if (field.type === 'checkbox') {
      acc[field.key] = Boolean(value);
      return acc;
    }

    if (value === '' || value === undefined) {
      return acc;
    }

    if (field.type === 'number') {
      const numericValue = Number(value);
      acc[field.key] = Number.isFinite(numericValue) ? numericValue : value;
      return acc;
    }

    acc[field.key] = value;
    return acc;
  }, {});
}

function buildSpecFromFields(
  fields: ResourceField[],
  values: Record<string, ResourceFieldValue>,
): Record<string, unknown> {
  return buildPayloadFromFields(fields, values);
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

export default function ResourceRequestsPage() {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<ResourceRequest | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [runsTarget, setRunsTarget] = useState<ResourceRequest | null>(null);
  const [provisioningRuns, setProvisioningRuns] = useState<ResourceProvisioningRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState('');
  const [replayingRunId, setReplayingRunId] = useState<string | null>(null);
  const [runSupervisor, setRunSupervisor] = useState<ResourceProvisioningRunSupervisor | null>(null);
  const [supervisorError, setSupervisorError] = useState('');
  const [recoveringStaleRuns, setRecoveringStaleRuns] = useState(false);
  const [processingQueuedRun, setProcessingQueuedRun] = useState(false);

  const loadRunSupervisor = async () => {
    try {
      const data = await api.get<ResourceProvisioningRunSupervisor>('/resource-requests/provisioning-runs/supervisor');
      setRunSupervisor(data);
      setSupervisorError('');
    } catch (err) {
      setSupervisorError(err instanceof Error ? err.message : '加载运行治理摘要失败');
    }
  };

  const loadData = async () => {
    try {
      const [requestData, typeData, projectData] = await Promise.all([
        api.get<ResourceRequest[]>('/resource-requests'),
        api.get<ResourceType[]>('/resource-types'),
        api.get<Project[]>('/projects'),
      ]);
      setRequests(requestData);
      setResourceTypes(typeData);
      setProjects(projectData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadRunSupervisor();
  }, []);

  const counts = useMemo(() => {
    return requests.reduce<Record<string, number>>((acc, request) => {
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    }, {});
  }, [requests]);

  const cancelRequest = async (id: string) => {
    if (!confirm('确定要取消这条资源申请吗？')) return;
    await api.post(`/resource-requests/${id}/cancel`);
    loadData();
  };

  const reviewRequest = async (id: string, status: 'approved' | 'rejected') => {
    await api.post(`/resource-requests/${id}/review`, { status });
    loadData();
  };

  const retryProvisioning = async (request: ResourceRequest) => {
    if (!confirm(`重新触发「${request.title}」的交付处理器吗？`)) return;
    setRetryingId(request.id);
    try {
      await api.post(`/resource-requests/${request.id}/retry-provisioning`);
      loadData();
    } finally {
      setRetryingId(null);
    }
  };

  const loadProvisioningRuns = async (request: ResourceRequest, reset = false) => {
    if (reset) {
      setProvisioningRuns([]);
    }
    setRunsError('');
    setRunsLoading(true);
    try {
      const runs = await api.get<ResourceProvisioningRun[]>(`/resource-requests/${request.id}/provisioning-runs`);
      setProvisioningRuns(runs);
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : '加载运行记录失败');
    } finally {
      setRunsLoading(false);
    }
  };

  const openProvisioningRuns = async (request: ResourceRequest) => {
    setRunsTarget(request);
    await loadProvisioningRuns(request, true);
  };

  const replayProvisioningRun = async (run: ResourceProvisioningRun) => {
    if (!runsTarget) return;
    if (!confirm(`重放「${runsTarget.title}」的这次交付运行吗？`)) return;
    setReplayingRunId(run.id);
    setRunsError('');
    try {
      await api.post(`/resource-requests/${runsTarget.id}/provisioning-runs/${run.id}/replay`);
      await Promise.all([
        loadData(),
        loadProvisioningRuns(runsTarget),
      ]);
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : '重放运行失败');
    } finally {
      setReplayingRunId(null);
    }
  };

  const recoverStaleProvisioningRuns = async () => {
    if (!confirm('恢复本团队超时未结束的外部交付运行吗？')) return;
    setRecoveringStaleRuns(true);
    setSupervisorError('');
    try {
      await api.post('/resource-requests/provisioning-runs/recover-stale', {
        limit: 20,
        staleAfterSeconds: String(runSupervisor?.staleAfterSeconds || 1800),
      });
      await Promise.all([
        loadData(),
        loadRunSupervisor(),
        runsTarget ? loadProvisioningRuns(runsTarget) : Promise.resolve(),
      ]);
    } catch (err) {
      setSupervisorError(err instanceof Error ? err.message : '恢复超时运行失败');
    } finally {
      setRecoveringStaleRuns(false);
    }
  };

  const processNextQueuedProvisioningRun = async () => {
    if (!confirm('处理本团队下一条可用的外部交付队列运行吗？')) return;
    setProcessingQueuedRun(true);
    setSupervisorError('');
    try {
      await api.post('/resource-requests/provisioning-runs/process-next', {});
      await Promise.all([
        loadData(),
        loadRunSupervisor(),
        runsTarget ? loadProvisioningRuns(runsTarget) : Promise.resolve(),
      ]);
    } catch (err) {
      setSupervisorError(err instanceof Error ? err.message : '处理队列运行失败');
    } finally {
      setProcessingQueuedRun(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">资源申请</h1>
          <p className="text-muted-foreground mt-1">申请数据库、Redis、端口、账号等项目资源</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          新建申请
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {(['pending', 'approved', 'completed', 'rejected', 'canceled'] as const).map((status) => (
          <div key={status} className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">{statusLabels[status]}</div>
            <div className="text-2xl font-semibold mt-1">{counts[status] || 0}</div>
          </div>
        ))}
      </div>

      <ProvisioningRunSupervisorPanel
        supervisor={runSupervisor}
        error={supervisorError}
        recovering={recoveringStaleRuns}
        processingQueued={processingQueuedRun}
        onRecover={recoverStaleProvisioningRuns}
        onProcessNext={processNextQueuedProvisioningRun}
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <h3 className="text-lg font-medium">还没有资源申请</h3>
          <p className="text-muted-foreground mt-2">发起第一条申请来占用或交付开发资源</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">申请</th>
                <th className="px-4 py-3 text-left text-sm font-medium">资源类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">项目/环境</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{request.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {request.requester?.name || request.requester?.email || '-'} · {new Date(request.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>{request.resourceType?.name || '-'}</div>
                    <code className="text-xs text-muted-foreground">{request.resourceType?.key}</code>
                    {request.resourceType?.provisioningMode && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        交付：{request.resourceType.provisioningMode}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>{request.project?.name || '未关联项目'}</div>
                    <div className="text-xs text-muted-foreground">{request.environment || '未指定环境'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {getStatusBadge(request.status)}
                      {getProvisioningBadge(request.result?.provisioning)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canViewProvisioningRuns(request) && (
                        <button
                          onClick={() => openProvisioningRuns(request)}
                          className="px-2 py-1 text-xs rounded border hover:bg-accent"
                        >
                          运行记录
                        </button>
                      )}
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => reviewRequest(request.id, 'approved')}
                            className="px-2 py-1 text-xs rounded border hover:bg-accent"
                          >
                            通过
                          </button>
                          <button
                            onClick={() => reviewRequest(request.id, 'rejected')}
                            className="px-2 py-1 text-xs rounded border hover:bg-accent"
                          >
                            驳回
                          </button>
                          <button
                            onClick={() => cancelRequest(request.id)}
                            className="px-2 py-1 text-xs rounded text-destructive hover:bg-destructive/10"
                          >
                            取消
                          </button>
                        </>
                      )}
                      {request.status === 'approved' && (
                        <>
                          {canRetryProvisioning(request.result?.provisioning) && (
                            <button
                              onClick={() => retryProvisioning(request)}
                              disabled={retryingId === request.id}
                              className="px-2 py-1 text-xs rounded border hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {retryingId === request.id ? '重试中' : '重试交付'}
                            </button>
                          )}
                          <button
                            onClick={() => setCompleteTarget(request)}
                            className="px-2 py-1 text-xs rounded border hover:bg-accent"
                          >
                            交付
                          </button>
                        </>
                      )}
                      {request.instance && (
                        <span className="px-2 py-1 text-xs rounded bg-muted">
                          实例：{request.instance.name}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CreateRequestModal
          resourceTypes={resourceTypes}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}

      {completeTarget && (
        <CompleteRequestModal
          request={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onSuccess={() => {
            setCompleteTarget(null);
            loadData();
          }}
        />
      )}

      {runsTarget && (
        <ProvisioningRunsModal
          request={runsTarget}
          runs={provisioningRuns}
          loading={runsLoading}
          error={runsError}
          replayingRunId={replayingRunId}
          onReplay={replayProvisioningRun}
          onClose={() => setRunsTarget(null)}
        />
      )}
    </div>
  );
}

function ProvisioningRunSupervisorPanel({
  supervisor,
  error,
  recovering,
  processingQueued,
  onRecover,
  onProcessNext,
}: {
  supervisor: ResourceProvisioningRunSupervisor | null;
  error: string;
  recovering: boolean;
  processingQueued: boolean;
  onRecover: () => void;
  onProcessNext: () => void;
}) {
  const counts = supervisor?.counts;
  const scheduler = supervisor?.scheduler;
  const queuedSample = supervisor?.samples.queued[0];
  const staleSample = supervisor?.samples.staleRunning[0];

  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">交付运行治理</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {supervisor ? `刷新 ${formatDateTime(supervisor.generatedAt)}` : '暂无运行治理摘要'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onProcessNext}
            disabled={processingQueued || !supervisor || (counts?.queued ?? 0) === 0}
            className="px-3 py-1.5 text-xs rounded border hover:bg-accent disabled:opacity-50"
          >
            {processingQueued ? '处理中' : '处理下一条队列'}
          </button>
          <button
            onClick={onRecover}
            disabled={recovering || !supervisor}
            className="px-3 py-1.5 text-xs rounded border hover:bg-accent disabled:opacity-50"
          >
            {recovering ? '恢复中' : '恢复超时运行'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-xs text-destructive">{error}</div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-7">
        {[
          ['队列中', counts?.queued ?? '-'],
          ['运行中', counts?.running ?? '-'],
          ['超时', counts?.staleRunning ?? '-'],
          ['已计划', counts?.planned ?? '-'],
          ['已阻断', counts?.blocked ?? '-'],
          ['失败', counts?.failed ?? '-'],
          ['完成', counts?.completed ?? '-'],
        ].map(([label, value]) => (
          <div key={label} className="rounded border px-3 py-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {supervisor && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded border px-2 py-1">自动补偿 {scheduler?.autoRetryEnabled ? '开启' : '关闭'}</span>
          <span className="rounded border px-2 py-1">僵尸恢复 {scheduler?.staleRecoveryEnabled ? '开启' : '关闭'}</span>
          <span className="rounded border px-2 py-1">队列开关 {scheduler?.queueingEnabled ? '开启' : '关闭'}</span>
          <span className="rounded border px-2 py-1">阈值 {supervisor.staleAfterSeconds}s</span>
          {queuedSample && (
            <span className="rounded border px-2 py-1">
              最早队列 {shortId(queuedSample.id)} · {formatDateTime(queuedSample.availableAt || queuedSample.queuedAt)}
            </span>
          )}
          {staleSample && (
            <span className="rounded border px-2 py-1">
              最早超时 {shortId(staleSample.id)} · {formatDateTime(staleSample.startedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusBadge(status: ResourceRequest['status']) {
  const classes: Record<ResourceRequest['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
    canceled: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${classes[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function getProvisioningBadge(provisioning?: ProvisioningResult) {
  if (!provisioning?.status) {
    return null;
  }

  const classes: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    planned: 'bg-blue-100 text-blue-700',
    blocked: 'bg-red-100 text-red-700',
    queued: 'bg-purple-100 text-purple-700',
  };
  const label = provisioning.status === 'completed'
    ? '处理完成'
    : provisioning.status === 'planned'
      ? '已生成计划'
      : provisioning.status === 'blocked'
        ? '处理阻断'
        : provisioning.status === 'queued'
          ? '已入队'
          : provisioning.status;

  return (
    <div
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs ${
        classes[provisioning.status] || 'bg-muted text-muted-foreground'
      }`}
      title={provisioning.reason || provisioning.boundary || provisioning.mode}
    >
      <span className="truncate">
        {provisioning.mode ? `${provisioning.mode} · ${label}` : label}
      </span>
    </div>
  );
}

function canRetryProvisioning(provisioning?: ProvisioningResult) {
  return provisioning?.status === 'blocked' || provisioning?.status === 'planned';
}

function canViewProvisioningRuns(request: ResourceRequest) {
  return Boolean(
    request.result?.provisioning?.provisioningRunId
    || request.resourceType?.provisioningMode === 'api'
    || request.resourceType?.provisioningMode === 'webhook',
  );
}

function canReplayProvisioningRun(request: ResourceRequest, run: ResourceProvisioningRun) {
  const currentRunId = request.result?.provisioning?.provisioningRunId;
  return request.status === 'approved'
    && currentRunId === run.id
    && (run.mode === 'api' || run.mode === 'webhook')
    && ['planned', 'blocked', 'failed'].includes(run.status || '');
}

function getRunStatusBadge(status?: string) {
  const classes: Record<string, string> = {
    queued: 'bg-purple-100 text-purple-700',
    running: 'bg-blue-100 text-blue-700',
    planned: 'bg-sky-100 text-sky-700',
    blocked: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    queued: '已入队',
    running: '运行中',
    planned: '已计划',
    blocked: '已阻断',
    completed: '已完成',
    failed: '失败',
  };
  const value = status || 'unknown';

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${classes[value] || 'bg-muted text-muted-foreground'}`}>
      {labels[value] || value}
    </span>
  );
}

function getRunTriggerLabel(trigger?: string) {
  const labels: Record<string, string> = {
    approval: '审批触发',
    manual_retry: '手动重试',
    auto_retry: '自动补偿',
  };
  return trigger ? labels[trigger] || trigger : '-';
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

function summarizeRecord(value?: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) {
    return '-';
  }
  return Object.keys(value).slice(0, 6).join(', ');
}

function shortId(value?: string) {
  return value ? value.slice(0, 8) : '-';
}

function ProvisioningRunsModal({
  request,
  runs,
  loading,
  error,
  replayingRunId,
  onReplay,
  onClose,
}: {
  request: ResourceRequest;
  runs: ResourceProvisioningRun[];
  loading: boolean;
  error: string;
  replayingRunId: string | null;
  onReplay: (run: ResourceProvisioningRun) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-5xl p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">交付运行记录</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {request.title} · {request.resourceType?.name || '资源'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-sm rounded border hover:bg-accent"
          >
            关闭
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">加载运行记录...</div>
        ) : runs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">暂无外部交付运行记录</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-left font-medium">触发/模式</th>
                  <th className="px-3 py-2 text-left font-medium">Adapter</th>
                  <th className="px-3 py-2 text-left font-medium">尝试</th>
                  <th className="px-3 py-2 text-left font-medium">Provider</th>
                  <th className="px-3 py-2 text-left font-medium">时间</th>
                  <th className="px-3 py-2 text-left font-medium">摘要</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map((run) => (
                  <tr key={run.id} className="align-top">
                    <td className="px-3 py-3">
                      {getRunStatusBadge(run.status)}
                      {run.autoRetry && (
                        <div className="mt-1 text-xs text-muted-foreground">自动补偿</div>
                      )}
                      {run.recoveredAt && (
                        <div className="mt-1 text-xs text-red-700">已恢复</div>
                      )}
                      {run.queueMode === 'queued' && (
                        <div className="mt-1 text-xs text-muted-foreground">队列运行</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div>{getRunTriggerLabel(run.trigger)}</div>
                      <div className="text-xs text-muted-foreground">{run.mode || '-'} · {run.boundary || '-'}</div>
                      {run.replayOfRunId && (
                        <div className="text-xs text-muted-foreground">源 {shortId(run.replayOfRunId)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div>{run.executorKey || '-'}</div>
                      <div className="text-xs text-muted-foreground">{run.adapterKey || '-'}</div>
                      {run.authAdapterKey && (
                        <div className="text-xs text-muted-foreground">{run.authAdapterKey}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div>{run.attempt ?? 0} / {run.maxAttempts ?? 1}</div>
                      <div className="text-xs text-muted-foreground">{run.retryable ? '可重试' : '不可重试'}</div>
                      {Boolean(run.replayAttemptsCount) && (
                        <div className="text-xs text-muted-foreground">已重放 {run.replayAttemptsCount} 次</div>
                      )}
                      {Boolean(run.recoveryCount) && (
                        <div className="text-xs text-muted-foreground">恢复 {run.recoveryCount} 次</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-[180px] truncate" title={run.providerRunId || undefined}>
                        {run.providerRunId || '-'}
                      </div>
                      <code className="block max-w-[220px] truncate text-xs text-muted-foreground" title={run.idempotencyKey || undefined}>
                        {run.idempotencyKey || '-'}
                      </code>
                    </td>
                    <td className="px-3 py-3">
                      <div>{formatDateTime(run.startedAt)}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(run.finishedAt)}</div>
                      {run.queuedAt && (
                        <div className="text-xs text-muted-foreground">入队 {formatDateTime(run.queuedAt)}</div>
                      )}
                      {run.availableAt && (
                        <div className="text-xs text-muted-foreground">可用 {formatDateTime(run.availableAt)}</div>
                      )}
                      {run.recoveredAt && (
                        <div className="text-xs text-muted-foreground">恢复 {formatDateTime(run.recoveredAt)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {run.recoveryReason ? (
                        <div className="max-w-[220px] text-red-700" title={run.recoveryReason}>
                          {run.recoveryReason}
                        </div>
                      ) : run.error ? (
                        <div className="max-w-[220px] text-destructive" title={run.error}>{run.error}</div>
                      ) : (
                        <div className="text-muted-foreground">
                          params: {summarizeRecord(run.params)}
                          <br />
                          result: {summarizeRecord(run.result)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {canReplayProvisioningRun(request, run) ? (
                        <button
                          onClick={() => onReplay(run)}
                          disabled={replayingRunId === run.id}
                          className="px-2 py-1 text-xs rounded border hover:bg-accent disabled:opacity-50"
                        >
                          {replayingRunId === run.id ? '重放中' : '重放'}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateRequestModal({
  resourceTypes,
  projects,
  onClose,
  onSuccess,
}: {
  resourceTypes: ResourceType[];
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    resourceTypeId: resourceTypes[0]?.id || '',
    projectId: '',
    title: '',
    environment: 'dev',
    purpose: '',
    spec: '{}',
  });
  const selectedResourceType = useMemo(
    () => resourceTypes.find((type) => type.id === formData.resourceTypeId),
    [formData.resourceTypeId, resourceTypes],
  );
  const fields = useMemo(() => getResourceFields(selectedResourceType), [selectedResourceType]);
  const hasEnvironmentField = fields.some((field) => field.key === 'environment');
  const [fieldValues, setFieldValues] = useState<Record<string, ResourceFieldValue>>(
    () => buildInitialFieldValues(resourceTypes[0]),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initialValues = buildInitialFieldValues(selectedResourceType);
    setFieldValues(initialValues);

    if (typeof initialValues.environment === 'string' && initialValues.environment) {
      setFormData((current) => ({ ...current, environment: initialValues.environment as string }));
    }
  }, [selectedResourceType]);

  const updateFieldValue = (key: string, value: ResourceFieldValue) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
    if (key === 'environment' && typeof value === 'string') {
      setFormData((current) => ({ ...current, environment: value }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const spec = fields.length > 0 ? buildSpecFromFields(fields, fieldValues) : JSON.parse(formData.spec || '{}');
      await api.post('/resource-requests', {
        resourceTypeId: formData.resourceTypeId,
        projectId: formData.projectId || undefined,
        title: formData.title,
        environment: formData.environment || undefined,
        purpose: formData.purpose || undefined,
        spec,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建申请失败，请检查 JSON 格式');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">新建资源申请</h2>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">资源类型</label>
            <select
              value={formData.resourceTypeId}
              onChange={(event) => setFormData({ ...formData, resourceTypeId: event.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              {resourceTypes.length === 0 && <option value="">暂无可用资源类型</option>}
              {resourceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.key})
                </option>
              ))}
            </select>
          </div>

          {resourceTypes.length === 0 && (
            <div className="p-3 rounded-md bg-muted text-sm text-muted-foreground">
              请先在资源类型中新增或启用资源类型。
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">申请标题</label>
            <input
              value={formData.title}
              onChange={(event) => setFormData({ ...formData, title: event.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="申请 dev 环境 Redis"
            />
          </div>

          <div className={`grid gap-3 ${hasEnvironmentField ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-sm font-medium mb-1">关联项目</label>
              <select
                value={formData.projectId}
                onChange={(event) => setFormData({ ...formData, projectId: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">不关联</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            {!hasEnvironmentField && (
              <div>
                <label className="block text-sm font-medium mb-1">环境</label>
                <input
                  value={formData.environment}
                  onChange={(event) => setFormData({ ...formData, environment: event.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="dev / test / prod"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">用途</label>
            <textarea
              value={formData.purpose}
              onChange={(event) => setFormData({ ...formData, purpose: event.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md resize-none"
            />
          </div>

          {fields.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">申请规格</div>
              <div className="grid grid-cols-2 gap-3">
                {fields.map((field) => (
                  <DynamicResourceField
                    key={field.key}
                    field={field}
                    value={fieldValues[field.key] ?? getFieldDefaultValue(field)}
                    onChange={(value) => updateFieldValue(field.key, value)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">规格 JSON</label>
              <textarea
                value={formData.spec}
                onChange={(event) => setFormData({ ...formData, spec: event.target.value })}
                rows={6}
                className="w-full px-3 py-2 border rounded-md font-mono text-sm"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md">
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !formData.resourceTypeId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {saving ? '提交中...' : '提交申请'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteRequestModal({
  request,
  onClose,
  onSuccess,
}: {
  request: ResourceRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const deliveryFields = useMemo(
    () => getSchemaFields(request.resourceType?.deliverySchema),
    [request.resourceType?.deliverySchema],
  );
  const [fieldValues, setFieldValues] = useState<Record<string, ResourceFieldValue>>(
    () => buildInitialValuesFromFields(deliveryFields),
  );
  const [formData, setFormData] = useState({
    instanceName: request.title,
    expiresAt: '',
    createInstance: true,
    config: '{}',
    delivery: '{}',
    credentials: '{}',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFieldValues(buildInitialValuesFromFields(deliveryFields));
  }, [deliveryFields]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const config = parseJsonObject(formData.config, '实例配置');
      const delivery = deliveryFields.length > 0
        ? buildPayloadFromFields(deliveryFields, fieldValues, (field) => !field.sensitive)
        : parseJsonObject(formData.delivery, '交付信息');
      const credentials = deliveryFields.length > 0
        ? buildPayloadFromFields(deliveryFields, fieldValues, (field) => Boolean(field.sensitive))
        : parseJsonObject(formData.credentials, '敏感凭证');

      await api.post(`/resource-requests/${request.id}/complete`, {
        instanceName: formData.instanceName || request.title,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
        createInstance: formData.createInstance,
        config,
        delivery,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '交付失败，请检查表单内容');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">交付资源</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {request.title} · {request.resourceType?.name || '资源'}
        </p>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">实例名称</label>
              <input
                value={formData.instanceName}
                onChange={(event) => setFormData({ ...formData, instanceName: event.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">过期时间</label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(event) => setFormData({ ...formData, expiresAt: event.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.createInstance}
              onChange={(event) => setFormData({ ...formData, createInstance: event.target.checked })}
              className="h-4 w-4"
            />
            创建资源实例并关联申请
          </label>

          {deliveryFields.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">交付信息</div>
              <div className="grid grid-cols-2 gap-3">
                {deliveryFields.map((field) => (
                  <DynamicResourceField
                    key={field.key}
                    field={field}
                    value={fieldValues[field.key] ?? getFieldDefaultValue(field)}
                    onChange={(value) => setFieldValues((current) => ({ ...current, [field.key]: value }))}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">交付信息 JSON</label>
                <textarea
                  value={formData.delivery}
                  onChange={(event) => setFormData({ ...formData, delivery: event.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">敏感凭证 JSON</label>
                <textarea
                  value={formData.credentials}
                  onChange={(event) => setFormData({ ...formData, credentials: event.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">实例配置 JSON</label>
            <textarea
              value={formData.config}
              onChange={(event) => setFormData({ ...formData, config: event.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {saving ? '交付中...' : '确认交付'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DynamicResourceField({
  field,
  value,
  onChange,
}: {
  field: ResourceField;
  value: ResourceFieldValue;
  onChange: (value: ResourceFieldValue) => void;
}) {
  const baseClassName = 'w-full px-3 py-2 border rounded-md bg-background';
  const stringValue = typeof value === 'boolean' ? '' : value;
  const fieldBody = (() => {
    if (field.type === 'textarea') {
      return (
        <textarea
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          required={field.required}
          placeholder={field.placeholder}
          className={`${baseClassName} resize-none`}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          className={baseClassName}
        >
          <option value="">请选择</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <label className="flex h-10 items-center gap-2 px-3 py-2 border rounded-md bg-background">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-muted-foreground">是</span>
        </label>
      );
    }

    return (
      <input
        type={field.type}
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        placeholder={field.placeholder}
        className={baseClassName}
      />
    );
  })();

  return (
    <div className={field.type === 'textarea' ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium mb-1">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {fieldBody}
    </div>
  );
}
