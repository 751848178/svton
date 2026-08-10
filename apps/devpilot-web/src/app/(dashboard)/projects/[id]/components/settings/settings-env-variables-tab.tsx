/**
 * 环境配置子区：变量与密钥（Demo 对齐，AC-SET-041）
 *
 * 单一职责：编排「变量与密钥」子区——
 *   - Demo 快照 callout + 当前生效修订徽标
 *   - 六列表（键/组件作用域/来源/环境值·引用/要求/校验，来源严格三分类，
 *     密钥引用 vault 掩码、资源注入、普通变量暂存态）
 *   - 编辑面：普通变量行编辑器 + .env 导入（敏感 KEY 分类排除）+
 *     staged diff 审查 + Secret 引用勾选
 *   - 跨环境复用（AC-SET-036）：多选目标环境逐修订写入
 *   - 修订历史（AC-SET-039）：R/来源/时间/变更说明/创建人
 */
'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { useEnvironmentEnvCopy } from '../../hooks/use-environment-env-copy';
import { useEnvironmentEnvVars } from '../../hooks/use-environment-env-vars';
import { useResourceInstanceInjections } from '../../hooks/use-resource-instance-injections';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import { diffEnvVars } from '../../utils/env-var-diff.utils';
import { EnvironmentConfigRevisionHistory } from '../environment-config-revision-history';
import { EnvironmentEnvCopyDialog } from '../environment-env-copy-dialog';
import { EnvironmentEnvImportModal } from '../environment-env-import-modal';
import { EnvironmentEnvReviewModal } from '../environment-env-review-modal';
import { EnvironmentEnvVarsTable } from '../environment-env-vars-table';
import { EnvironmentPlainVarsEditor } from '../environment-plain-vars-editor';
import { EnvironmentStagedBanner } from '../environment-staged-banner';
import { SubtabShell } from './settings-subtab-shell';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvVariablesTab({
  environment,
  detail,
  secretIds,
  onSecretIdsChange,
  revision,
  revisions,
  environments,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  secretIds: string[];
  onSecretIdsChange: (next: string[]) => void;
  revision: EnvironmentConfigRevision | null;
  revisions: EnvironmentConfigRevision[];
  environments: ProjectEnvironment[];
}) {
  const t = useTranslations('projects');
  const project = detail.project;

  const { vars, draft, setDraft, mergeDraft, saving, save, reset } = useEnvironmentEnvVars(
    environment,
    detail.loadProject,
  );
  const { copying, copy } = useEnvironmentEnvCopy(environment.id);

  const [importOpen, setImportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment.id]);

  const diff = useMemo(() => diffEnvVars(vars, draft), [vars, draft]);
  const rows = Object.entries(draft);

  const secrets = (project?.secretKeys ?? []).filter(
    (secret) => !secret.environment || secret.environment.id === environment.id,
  );
  const secretRefs = useMemo(
    () => secrets
      .filter((secret) => secretIds.includes(secret.id))
      .map((secret) => ({ id: secret.id, name: secret.name, type: secret.type })),
    [secrets, secretIds],
  );
  const committedSecretIds = useMemo(
    () => new Set((revision?.secretReferences ?? []).map((ref) => ref.id)),
    [revision],
  );
  const resourceInjections = useResourceInstanceInjections(
    project?.id ?? '',
    revision?.resourceReferences,
  );

  if (!project) return null;

  const projectId = project.id;
  const keysManageHref = `/keys?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(environment.id)}`;

  const toggle = (id: string, checked: boolean) => {
    onSecretIdsChange(
      checked
        ? [...new Set([...secretIds, id])]
        : secretIds.filter((item) => item !== id),
    );
  };

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

  const handleCopied = () => {
    detail.loadProject();
  };

  return (
    <SubtabShell
      title={t('envTabVariables')}
      helper={t('envTabHelperVariables')}
      moduleHref={keysManageHref}
      moduleLabel={t('envModuleLinkKeys')}
    >      <div className="space-y-4">
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('envVarsSnapshotCallout')}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('envVarsTableTitle')}
          </h4>
          {revision ? (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
              {t('envVarsCurrentBadge', { revision: revision.revision })}
            </span>
          ) : null}
        </div>

        <EnvironmentEnvVarsTable
          plainVars={draft}
          secretRefs={secretRefs}
          committedSecretIds={committedSecretIds}
          resourceInjections={resourceInjections}
          t={t}
        />

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

        <div className="space-y-1">
          <div className="text-xs font-medium">{t('configSecretReferences')}</div>
          {secrets.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('configNoSecrets')}</p>
          ) : (
            <div className="flex flex-wrap gap-3 text-xs">
              {secrets.map((secret) => (
                <label key={secret.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={secretIds.includes(secret.id)}
                    onChange={(event) => toggle(secret.id, event.target.checked)}
                  />
                  {secret.name} · {secret.type}
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{t('configSecretReferenceHint')}</p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setCopyOpen(true)}
            disabled={rows.length === 0 && secretRefs.length === 0}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            {t('envVarsCopyButton')}
          </button>
        </div>

        <EnvironmentConfigRevisionHistory revisions={revisions} t={t} />

        <EnvironmentEnvImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          existingKeys={new Set(Object.keys(vars))}
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

        <EnvironmentEnvCopyDialog
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          environments={environments}
          sourceEnvironment={environment}
          plainVars={draft}
          secretRefs={secretRefs}
          copy={copy}
          copying={copying}
          onCopied={handleCopied}
          t={t}
        />
      </div>
    </SubtabShell>
  );
}
