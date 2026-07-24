/**
 * 环境变量区块（普通变量可编辑 + 密钥变量只读）
 *
 * 单一职责：在 environment-detail-drawer 内编排「部署时会注入该环境的变量」展示与编辑。
 *   - 普通变量：来自 environment.config.envVars，编辑委托给 EnvironmentPlainVarsEditor，
 *     落库走 use-environment-env-vars（PUT /project-environments/:id）。
 *   - 密钥变量：来自 project.secretKeys 中 environment.id === environment.id 的项，
 *     只展示 KEY 名与类型（密钥值永不展示），提供「管理密钥」深链到
 *     /keys?projectId=&environmentId=（已支持过滤，见 keys/page.tsx）。
 *
 * 安全：密钥值绝不在此展示；普通变量按设计为非敏感，但 UI 仍提示用户勿放敏感值。
 */
'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEnvironmentEnvVars } from '../hooks/use-environment-env-vars';
import { EnvironmentPlainVarsEditor } from './environment-plain-vars-editor';
import type { Project, ProjectEnvironment, ProjectSecretKey } from '../types';

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
  const { draft, setDraft, saving, save, reset } = useEnvironmentEnvVars(environment, onSaved);

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

  const keysManageHref = `/keys?projectId=${project.id}&environmentId=${environment.id}`;

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envVarsTitle')}
      </h4>

      <EnvironmentPlainVarsEditor
        rows={rows}
        saving={saving}
        onAdd={addRow}
        onRemove={removeRow}
        onUpdate={updateRow}
        onSave={save}
        t={t}
      />

      <SecretVarsList secretKeys={secretKeys} keysManageHref={keysManageHref} t={t} />
    </section>
  );
}

interface SecretVarsListProps {
  secretKeys: ProjectSecretKey[];
  keysManageHref: string;
  t: ProjectsTranslator;
}

function SecretVarsList({ secretKeys, keysManageHref, t }: SecretVarsListProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-medium text-muted-foreground">{t('envVarsSecretTitle')}</h5>
        <Link href={keysManageHref} className="text-xs text-primary hover:underline">
          {t('envVarsManageKeys')}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">{t('envVarsSecretHint')}</p>
      {secretKeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('envVarsSecretEmpty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {secretKeys.map((sk) => (
            <li key={sk.id} className="flex items-center gap-2">
              <span className="font-mono text-xs">{deriveEnvKey(sk.name)}</span>
              <span className="text-xs text-muted-foreground">{sk.type}</span>
              <span className="font-mono text-xs text-muted-foreground">••••••••</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 与后端 exportAsEnv 同源的 KEY 名派生（name.toUpperCase().replace(/[^A-Z0-9]/g, '_')）。 */
function deriveEnvKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}
