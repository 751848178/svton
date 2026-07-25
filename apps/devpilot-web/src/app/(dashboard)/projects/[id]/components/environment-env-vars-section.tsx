/**
 * 环境变量区块（普通变量可编辑 + 密钥变量只读 + staged changes）
 *
 * 单一职责：在 environment-detail-drawer 内编排「部署时会注入该环境的变量」展示与编辑。
 *   - 普通变量：来自 environment.config.envVars，编辑委托给 EnvironmentPlainVarsEditor，
 *     落库走 use-environment-env-vars（PUT /project-environments/:id）。
 *   - 批量导入：EnvironmentEnvImportModal 解析粘贴的 .env，mergeDraft 合并进暂存区。
 *   - staged changes：draft 与已落库 vars 不一致时顶栏提示「N 项待部署」，
 *     Review 弹窗显示 diff（新增/修改/删除），Deploy 一次性落库。
 *   - 密钥变量：只展示 KEY 名与类型（密钥值永不展示），深链到 /keys 过滤页。
 *   - 资源实例：只展示绑定的资源实例注入的 KEY 名。
 *
 * 安全：密钥值绝不在此展示；普通变量按设计为非敏感，但 UI 仍提示用户勿放敏感值。
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import { useEnvironmentEnvVars } from '../hooks/use-environment-env-vars';
import { EnvironmentPlainVarsEditor } from './environment-plain-vars-editor';
import { EnvironmentEnvImportModal } from './environment-env-import-modal';
import { EnvironmentEnvReviewModal } from './environment-env-review-modal';
import { EnvironmentStagedBanner } from './environment-staged-banner';
import { EnvironmentSecretVarsList } from './environment-secret-vars-list';
import { EnvironmentResourceInstanceList } from './environment-resource-instance-list';
import { diffEnvVars } from '../utils/env-var-diff.utils';
import type { Project, ProjectEnvironment, ProjectSecretKey, ProjectResourceInstance } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentEnvVarsSectionProps {
  environment: ProjectEnvironment;
  project: Project;
  onSaved: (updated: ProjectEnvironment) => void;
}

export function EnvironmentEnvVarsSection({
  environment,
  project,
  onSaved,
}: EnvironmentEnvVarsSectionProps) {
  const t = useTranslations('projects');
  const { vars, draft, setDraft, mergeDraft, saving, save, reset } = useEnvironmentEnvVars(
    environment,
    onSaved,
  );

  const [importOpen, setImportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);

  // environment 切换时，把本地 draft 重置为新环境的落库值。
  // 只依赖 environment.id：reset 内部已读取最新 environment，避免每次渲染重置覆盖编辑。
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment.id]);

  const secretKeys = useMemo<ProjectSecretKey[]>(
    () => (project.secretKeys ?? []).filter((k) => k.environment?.id === environment.id),
    [project.secretKeys, environment.id],
  );

  const resourceInstances = useMemo<ProjectResourceInstance[]>(
    () => (project.resourceInstances ?? []).filter((i) => i.projectEnvironment?.id === environment.id),
    [project.resourceInstances, environment.id],
  );

  const diff = useMemo(() => diffEnvVars(vars, draft), [vars, draft]);

  const rows = Object.entries(draft);

  const updateRow = (oldKey: string, field: 'key' | 'value', val: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (k === oldKey) next[field === 'key' ? val : k] = field === 'value' ? val : v;
      else next[k] = v;
    }
    setDraft(next);
  };

  const addRow = () => {
    const base = 'NEW_KEY_';
    let n = 1;
    while (draft[`${base}${n}`] !== undefined) n += 1;
    setDraft({ ...draft, [`${base}${n}`]: '' });
  };

  const removeRow = (key: string) => {
    const next = { ...draft };
    delete next[key];
    setDraft(next);
  };

  const handleImport = (incoming: Record<string, string>) => {
    mergeDraft(incoming);
    feedback.success(t('envImportApplied', { count: Object.keys(incoming).length }));
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      await save();
      feedback.success(t('envVarsSaveSuccess'));
      setReviewOpen(false);
    } catch (err) {
      feedback.error(t('envVarsSaveFailed'), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeploying(false);
    }
  };

  const handleDiscard = () => {
    reset();
    feedback.success(t('stagedDiscarded'));
  };

  const keysManageHref = `/keys?projectId=${project.id}&environmentId=${environment.id}`;

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envVarsTitle')}
      </h4>

      <EnvironmentStagedBanner
        pendingCount={diff.total}
        onReview={() => setReviewOpen(true)}
        onDiscard={handleDiscard}
        t={t}
      />

      <EnvironmentPlainVarsEditor
        rows={rows}
        saving={saving || deploying}
        onAdd={addRow}
        onRemove={removeRow}
        onUpdate={updateRow}
        onImportEnv={() => setImportOpen(true)}
        onSave={save}
        t={t}
      />

      <EnvironmentResourceInstanceList instances={resourceInstances} t={t} />

      <EnvironmentSecretVarsList secretKeys={secretKeys} keysManageHref={keysManageHref} t={t} />

      <EnvironmentEnvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingKeys={new Set(Object.keys(draft))}
        onImport={handleImport}
        t={t}
      />

      <EnvironmentEnvReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        changes={diff.changes}
        deploying={deploying}
        onDeploy={handleDeploy}
        t={t}
      />
    </section>
  );
}
