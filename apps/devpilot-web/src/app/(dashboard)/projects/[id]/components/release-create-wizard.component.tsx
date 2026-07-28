/**
 * 创建发布向导（F383, invest-3 §A.4/B.1/C.2）
 *
 * 单一职责：环境/名称/分支输入 + 服务多选（按目标环境过滤）+ 预览→创建流程编排。
 * - 分支默认取 Application.defaultBranch（Picshare=master）；缺省回退 main 并告警。
 * - buildInput 强制 environmentId 为目标环境（杜绝 dev/prod 翻转）。
 * - 预览↔创建强绑定：创建需 preview；表单任意变化失效预览；409 stale 自动重新预览。
 * 服务列表与预览面板分别委托 ReleaseServiceSelect / ReleasePreviewPane。
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@svton/ui';
import { Button, ErrorBanner, Input, Select } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { classifyReleaseError } from '../utils/release-error-taxonomy.utils';
import { ReleaseServiceSelect } from './release-service-select.component';
import { ReleasePreviewPane } from './release-preview-pane.component';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { useProjectReleaseOperations } from '../hooks/use-project-release-operations';
import type {
  ReleasePlanPreview,
  ReleaseServiceInputItem,
} from '../types/releases';

type DetailHook = ReturnType<typeof useProjectDetail>;
type Ops = ReturnType<typeof useProjectReleaseOperations>;

export interface ReleaseCreateWizardProps {
  detail: DetailHook;
  ops: Ops;
  onCancel: () => void;
  onCreated: (planId: string) => void;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

export function ReleaseCreateWizard({ detail, ops, onCancel, onCreated }: ReleaseCreateWizardProps): JSX.Element {
  const environments = detail.project?.environments ?? [];
  const applications = useMemo(() => detail.project?.applications ?? [], [detail.project?.applications]);
  const [environmentId, setEnvironmentId] = useState(
    environments.find((e) => e.status === 'active')?.id ?? environments[0]?.id ?? '',
  );
  const [name, setName] = useState(`release-${new Date().toISOString().slice(0, 16)}`);
  const firstDefaultBranch = applications[0]?.defaultBranch ?? null;
  const [branch, setBranch] = useState(firstDefaultBranch ?? 'main');
  const branchWarn = firstDefaultBranch ? '' : '未配置默认分支，已回退 main，请按需修改';
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<ReleasePlanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const envName = environments.find((e) => e.id === environmentId)?.name ?? '';

  const buildInput = useCallback((): ReleaseServiceInputItem[] => {
    const out: ReleaseServiceInputItem[] = [];
    for (const app of applications) {
      for (const svc of app.services ?? []) {
        if (svc.environment?.id !== environmentId) continue;
        if (!selectedServices.has(svc.id)) continue;
        out.push({
          applicationId: app.id,
          applicationServiceId: svc.id,
          // 强制使用目标环境，杜绝 dev/prod 翻转（invest-3 §A.4）。
          environmentId,
          serverId: svc.server?.id,
          serviceName: svc.name,
        });
      }
    }
    return out;
  }, [applications, environmentId, selectedServices]);

  // 环境切换时清除不再属于目标环境的已选服务（P0-1 §8）：
  // 切换 dev→prod 后，dev 下选中的 service id 在 prod 下无效，必须清掉，
  // 避免把失效的 selectedServices 带进 buildInput（被 env 过滤跳过 → 静默丢服务）。
  useEffect(() => {
    const valid = new Set<string>();
    for (const app of applications) {
      for (const svc of app.services ?? []) {
        if (svc.environment?.id === environmentId) valid.add(svc.id);
      }
    }
    setSelectedServices((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) if (valid.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [applications, environmentId]);

  // 表单任意变化即失效预览（invest-3 §C.2）。
  useEffect(() => {
    setPreview(null);
  }, [environmentId, name, branch, selectedServices]);

  const handlePreview = useCallback(async () => {
    setError('');
    const services = buildInput();
    if (services.length === 0) {
      setError('请至少选择一个应用服务');
      return;
    }
    setLoading(true);
    try {
      const p = await ops.preview({ environmentId, name, branch: branch || undefined, services });
      setPreview(p);
    } catch (err) {
      setError(classifyReleaseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [buildInput, environmentId, name, branch, ops]);

  const handleSubmit = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const services = buildInput();
      const result = await ops.create({
        environmentId,
        name,
        branch: branch || undefined,
        services,
        expectedPlanHash: preview?.planHash,
      });
      onCreated(result.id);
    } catch (err) {
      const view = classifyReleaseError(err);
      setError(view.message);
      if (view.autoRepreview) {
        try {
          const p = await ops.preview({ environmentId, name, branch: branch || undefined, services: buildInput() });
          setPreview(p);
          feedback.success('已为你重新预览');
        } catch {
          /* 静默：已通过外层 error 提示 */
        }
      }
    } finally {
      setLoading(false);
    }
  }, [buildInput, environmentId, name, branch, ops, preview, onCreated]);

  return (
    <Card title="新建发布">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {branchWarn && <div className="text-xs text-orange-600">{branchWarn}</div>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">环境</span>
            <Select value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)}>
              {environments.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">发布名称</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">分支</span>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main / master" />
          </label>
        </div>

        <ReleaseServiceSelect
          applications={applications}
          environmentId={environmentId}
          environmentName={envName}
          selected={selectedServices}
          onChange={setSelectedServices}
        />

        {preview && <ReleasePreviewPane preview={preview} />}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button variant="outline" onClick={handlePreview} loading={loading}>预览（dry-run）</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!preview || loading}>
            创建正式发布
          </Button>
        </div>
      </div>
    </Card>
  );
}
