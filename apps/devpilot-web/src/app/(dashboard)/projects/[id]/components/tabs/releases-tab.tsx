/**
 * 发布 Tab（F383）
 *
 * 单一职责：项目详情的发布编排入口。顶部显示当前结论 + 推荐下一步 + 阻塞；
 * 主视图为按依赖排序的阶段卡片；支持创建预览、执行、取消、重试、跳过、刷新恢复。
 * URL 恢复：?tab=releases&releasePlanId=<id>&stageId=<id>。
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, EmptyState, LoadingState } from '@svton/ui';
import { useTranslations } from 'next-intl';
import {
  Button,
  ErrorBanner,
  Select,
  Input,
  StatusTag,
} from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { useProjectReleaseOperations } from '../../hooks/use-project-release-operations';
import type {
  ReleasePlan,
  ReleasePlanPreview,
  ReleaseServiceInputItem,
} from '../../types/releases';
import { ReleaseStageCard } from '../release-stage-card';

type DetailHook = ReturnType<typeof useProjectDetail>;

const POLL_INTERVAL_MS = 5_000;

export function ReleasesTab({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = detail.project?.id ?? '';

  const ops = useProjectReleaseOperations({
    projectId,
    reload: () => loadPlans(),
  });

  const [plans, setPlans] = useState<ReleasePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadPlans = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const list = await ops.list();
      setPlans(list);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // URL 恢复：releasePlanId
  useEffect(() => {
    const fromUrl = searchParams.get('releasePlanId');
    if (fromUrl && fromUrl !== selectedPlanId) {
      setSelectedPlanId(fromUrl);
    } else if (!fromUrl && plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [searchParams, plans, selectedPlanId]);

  const selectPlan = useCallback(
    (planId: string) => {
      setSelectedPlanId(planId);
      const next = new URLSearchParams(searchParams.toString());
      if (planId) next.set('releasePlanId', planId);
      else next.delete('releasePlanId');
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  // 自动轮询进行中的发布
  useEffect(() => {
    const active = selectedPlan && ['running', 'ready', 'blocked'].includes(selectedPlan.status);
    if (!active) return;
    const timer = setInterval(() => loadPlans(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [selectedPlan, loadPlans]);

  const conclusion = useMemo(() => deriveConclusion(selectedPlan), [selectedPlan]);

  const handleExecute = useCallback(
    async (planId: string) => {
      try {
        setLoadingAction(`execute:${planId}`);
        const r = await ops.execute(planId);
        feedback.success(`发布已开始执行（${r.status}）`);
      } catch (err) {
        feedback.error(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingAction(null);
      }
    },
    [ops],
  );

  const handleCancel = useCallback(
    async (planId: string) => {
      try {
        setLoadingAction(`cancel:${planId}`);
        await ops.cancel(planId);
        feedback.success('发布已取消');
      } catch (err) {
        feedback.error(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingAction(null);
      }
    },
    [ops],
  );

  const handleRetry = useCallback(
    async (stageId: string) => {
      if (!selectedPlanId) return;
      try {
        setLoadingAction(`retry:${stageId}`);
        await ops.retryStage(selectedPlanId, stageId);
        feedback.success('阶段已重新排队');
      } catch (err) {
        feedback.error(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingAction(null);
      }
    },
    [ops, selectedPlanId],
  );

  const handleSkip = useCallback(
    async (stageId: string, reason: string) => {
      if (!selectedPlanId) return;
      try {
        setLoadingAction(`skip:${stageId}`);
        await ops.skipStage(selectedPlanId, stageId, {
          reason,
          confirmationText: '我确认跳过此可选阶段',
        });
        feedback.success('阶段已跳过');
      } catch (err) {
        feedback.error(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingAction(null);
      }
    },
    [ops, selectedPlanId],
  );

  if (loading && plans.length === 0) {
    return <LoadingState />;
  }

  const isPlanExecutable = selectedPlan
    ? ['ready', 'running', 'blocked'].includes(selectedPlan.status)
    : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Select
            value={selectedPlanId}
            onChange={(e) => selectPlan(e.target.value)}
            className="min-w-[240px]"
          >
            <option value="">{t('tabReleases')}…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.status}）
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => loadPlans()} loading={loading}>
            刷新
          </Button>
        </div>
        <Button onClick={() => setShowCreate(true)}>新建发布</Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => loadPlans()} />}

      {selectedPlan ? (
        <>
          <ConclusionHeader
            plan={selectedPlan}
            conclusion={conclusion}
            onExecute={() => handleExecute(selectedPlan.id)}
            onCancel={() => handleCancel(selectedPlan.id)}
            loadingExecute={loadingAction === `execute:${selectedPlan.id}`}
            loadingCancel={loadingAction === `cancel:${selectedPlan.id}`}
          />

          <div className="space-y-3">
            {(selectedPlan.stages ?? [])
              .slice()
              .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
              .map((stage) => (
                <ReleaseStageCard
                  key={stage.id}
                  stage={stage}
                  isPlanExecutable={isPlanExecutable}
                  planStatus={selectedPlan.status}
                  onRetry={handleRetry}
                  onSkip={handleSkip}
                  loadingAction={loadingAction}
                />
              ))}
          </div>
        </>
      ) : (
        !showCreate && (
          <EmptyState
            text="暂无发布计划"
            description="从真实项目配置生成发布预览，按依赖编排数据与应用阶段。"
            action={<Button onClick={() => setShowCreate(true)}>新建发布</Button>}
          />
        )
      )}

      {showCreate && (
        <CreateReleaseWizard
          detail={detail}
          ops={ops}
          onCancel={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            selectPlan(id);
          }}
        />
      )}
    </div>
  );
}

// 顶部结论卡：当前结论 + 推荐下一步 + 阻塞 + 版本/环境/操作者
function ConclusionHeader({
  plan,
  conclusion,
  onExecute,
  onCancel,
  loadingExecute,
  loadingCancel,
}: {
  plan: ReleasePlan;
  conclusion: { summary: string; nextAction: string; blocked: string | null };
  onExecute: () => void;
  onCancel: () => void;
  loadingExecute: boolean;
  loadingCancel: boolean;
}) {
  const canExecute = plan.status === 'ready' || plan.status === 'blocked';
  const canCancel = !['succeeded', 'failed', 'canceled'].includes(plan.status);
  return (
    <Card>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusTag status={plan.status} />
          <span className="text-sm font-medium">{plan.name}</span>
          {plan.branch && (
            <span className="text-xs text-muted-foreground">分支：{plan.branch}</span>
          )}
          {plan.commitSha && (
            <span className="text-xs text-muted-foreground">
              提交：{plan.commitSha.slice(0, 8)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            环境：{plan.environment?.name ?? plan.environmentId.slice(-6)}
          </span>
          {plan.createdBy && (
            <span className="text-xs text-muted-foreground">
              操作者：{plan.createdBy.name ?? plan.createdBy.email}
            </span>
          )}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">当前结论：</span>
          {conclusion.summary}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">推荐下一步：</span>
          {conclusion.nextAction}
        </div>
        {conclusion.blocked && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
            <span className="font-medium text-destructive">需先解决：</span>
            {conclusion.blocked}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {canExecute && (
            <Button onClick={onExecute} loading={loadingExecute}>
              开始执行
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" onClick={onCancel} loading={loadingCancel}>
              取消发布
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// 创建发布向导：环境、分支、服务、预览、提交
function CreateReleaseWizard({
  detail,
  ops,
  onCancel,
  onCreated,
}: {
  detail: DetailHook;
  ops: ReturnType<typeof useProjectReleaseOperations>;
  onCancel: () => void;
  onCreated: (planId: string) => void;
}) {
  const environments = detail.project?.environments ?? [];
  const applications = useMemo(
    () => detail.project?.applications ?? [],
    [detail.project?.applications],
  );
  const [environmentId, setEnvironmentId] = useState(
    environments.find((e) => e.status === 'active')?.id ?? environments[0]?.id ?? '',
  );
  const [name, setName] = useState(`release-${new Date().toISOString().slice(0, 16)}`);
  const [branch, setBranch] = useState(detail.project?.gitRepo ? 'main' : '');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<ReleasePlanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buildInput = useCallback((): ReleaseServiceInputItem[] => {
    const out: ReleaseServiceInputItem[] = [];
    for (const app of applications) {
      for (const svc of app.services ?? []) {
        if (selectedServices.has(svc.id)) {
          const cfg = (svc.deployConfig ?? {}) as Record<string, unknown>;
          out.push({
            applicationId: app.id,
            applicationServiceId: svc.id,
            environmentId: svc.environment?.id ?? environmentId,
            serverId: svc.server?.id,
            serviceName: svc.name,
            preStartCheckCommand: str(cfg.preStartCheckCommand),
            migrationCommand: str(cfg.migrationCommand),
            initializationCommand: str(cfg.initializationCommand),
            deployCommand: str(cfg.deployCommand),
            healthCheckUrl: str(cfg.healthCheckUrl),
          });
        }
      }
    }
    return out;
  }, [applications, environmentId, selectedServices]);

  const handlePreview = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const services = buildInput();
      if (services.length === 0) {
        setError('请至少选择一个应用服务');
        return;
      }
      const p = await ops.preview({
        environmentId,
        name,
        branch: branch || undefined,
        services,
      });
      setPreview(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildInput, environmentId, name, branch, ops]);

  const handleSubmit = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const services = buildInput();
      const r = await ops.create({
        environmentId,
        name,
        branch: branch || undefined,
        services,
      });
      onCreated(r.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildInput, environmentId, name, branch, ops, onCreated]);

  return (
    <Card title="新建发布">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">环境</span>
            <Select value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)}>
              {environments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">发布名称</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">分支</span>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
          </label>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-2">选择应用服务</div>
          <div className="space-y-2 max-h-60 overflow-auto">
            {applications.map((app) =>
              (app.services ?? []).map((svc) => (
                <label key={svc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedServices.has(svc.id)}
                    onChange={(e) => {
                      const next = new Set(selectedServices);
                      if (e.target.checked) next.add(svc.id);
                      else next.delete(svc.id);
                      setSelectedServices(next);
                    }}
                  />
                  <span>
                    {app.name} / {svc.name}
                  </span>
                  {svc.environment && (
                    <span className="text-xs text-muted-foreground">
                      （{svc.environment.name}）
                    </span>
                  )}
                </label>
              )),
            )}
          </div>
        </div>

        {preview && (
          <div className="rounded border p-3 space-y-2 bg-muted/30">
            <div className="text-sm font-medium">预览：{preview.stages.length} 个阶段</div>
            <div className="flex flex-wrap gap-2">
              {preview.stages.map((s) => (
                <StatusTag
                  key={s.key}
                  variant="risk"
                  status={s.riskLevel}
                  label={`${s.name}（${s.riskLevel}）`}
                />
              ))}
            </div>
            {preview.sideEffects.length > 0 && (
              <div className="text-xs text-muted-foreground">
                副作用：{preview.sideEffects.length} 项（含数据/结构变更）
              </div>
            )}
            {preview.approvalRequired.length > 0 && (
              <div className="text-xs text-muted-foreground">
                需审批阶段：{preview.approvalRequired.length}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button variant="outline" onClick={handlePreview} loading={loading}>
            预览（dry-run）
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={selectedServices.size === 0}>
            创建正式发布
          </Button>
        </div>
      </div>
    </Card>
  );
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

// 推导当前结论 + 推荐下一步 + 阻塞
function deriveConclusion(plan: ReleasePlan | null): {
  summary: string;
  nextAction: string;
  blocked: string | null;
} {
  if (!plan) return { summary: '未选择发布计划', nextAction: '新建或选择一个发布', blocked: null };
  const stages = plan.stages ?? [];
  const failed = stages.filter((s) => s.status === 'failed');
  const blocked = stages.filter((s) => s.status === 'blocked');
  const awaiting = stages.filter((s) => s.status === 'awaiting_approval');
  const running = stages.filter((s) => s.status === 'running' || s.status === 'queued');
  const allDone = stages.every((s) =>
    ['succeeded', 'skipped', 'canceled'].includes(s.status),
  );

  if (plan.status === 'succeeded' || (allDone && stages.length > 0)) {
    return { summary: '发布已完成', nextAction: '可在部署 Tab 查看运行结果', blocked: null };
  }
  if (failed.length > 0) {
    return {
      summary: `${failed.length} 个阶段失败`,
      nextAction: `修复后重试 ${failed[0].name}`,
      blocked: failed[0].blockedReason ?? failed[0].name,
    };
  }
  if (awaiting.length > 0) {
    return {
      summary: '等待人工审批',
      nextAction: `审批 ${awaiting[0].name}`,
      blocked: null,
    };
  }
  if (running.length > 0) {
    return {
      summary: `正在执行 ${running.length} 个阶段`,
      nextAction: '等待关联运行完成（页面自动刷新）',
      blocked: null,
    };
  }
  if (blocked.length > 0) {
    return {
      summary: `${blocked.length} 个阶段被阻塞`,
      nextAction: '解决阻塞或重试',
      blocked: blocked[0].blockedReason ?? blocked[0].name,
    };
  }
  if (plan.status === 'ready') {
    return { summary: '发布就绪', nextAction: '点击「开始执行」', blocked: null };
  }
  return { summary: `发布状态：${plan.status}`, nextAction: '刷新查看最新进展', blocked: plan.blockedReason ?? null };
}
