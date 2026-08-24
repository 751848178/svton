/**
 * 跨环境复用配置弹窗（AC-SET-036）
 *
 * 单一职责：多选目标环境（同项目内、不含源环境），预览将复制的普通变量与
 * 密钥引用，确认后逐环境创建不可变修订（per-env CAS），并展示逐环境结果。
 * 密钥引用只显示名称；绝不携带或展示密钥明文。
 */
'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@svton/ui';
import { Checkbox } from '@/components/ui';
import type { ProjectEnvironment } from '../types';
import type { EnvCopyTarget } from '../hooks/use-environment-env-copy';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentEnvCopyDialogProps {
  open: boolean;
  onClose: () => void;
  environments: ProjectEnvironment[];
  sourceEnvironment: ProjectEnvironment;
  plainVars: Record<string, string>;
  secretRefs: Array<{ id: string; name: string; type: string }>;
  copy: (payload: {
    targets: EnvCopyTarget[];
    plainVariables: Record<string, string>;
    secretReferenceIds: string[];
    changeSummary?: string;
  }) => Promise<unknown>;
  copying: boolean;
  onCopied: () => void;
  t: ProjectsTranslator;
}

export function EnvironmentEnvCopyDialog({
  open,
  onClose,
  environments,
  sourceEnvironment,
  plainVars,
  secretRefs,
  copy,
  copying,
  onCopied,
  t,
}: EnvironmentEnvCopyDialogProps) {
  const tc = useTranslations('common');
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(
    () => environments
      .filter((env) => env.id !== sourceEnvironment.id && env.status !== 'archived')
      .sort((a, b) => a.key.localeCompare(b.key)),
    [environments, sourceEnvironment.id],
  );

  const toggle = (id: string, checked: boolean) => {
    setResult(null);
    setError(null);
    setSelected((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id),
    );
  };

  const varCount = Object.keys(plainVars).length;
  const secretCount = secretRefs.length;

  const handleConfirm = async () => {
    setResult(null);
    setError(null);
    try {
      const outcome = await copy({
        targets: selected.map((environmentId) => {
          const env = environments.find((item) => item.id === environmentId);
          return {
            environmentId,
            expectedCurrentRevisionId: env?.currentConfigRevisionId || undefined,
          };
        }),
        plainVariables: plainVars,
        secretReferenceIds: secretRefs.map((ref) => ref.id),
        changeSummary: t('envVarsCopyChangeSummary', { key: sourceEnvironment.key }),
      });
      const summary = summarize(outcome, t);
      setResult(summary);
      setSelected([]);
      onCopied();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('envVarsCopyFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('envVarsCopyTitle')}
      width={620}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={copying}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={copying || selected.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {copying ? t('envVarsCopying') : t('envVarsCopyConfirm')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('envVarsCopyHint', { key: sourceEnvironment.key })}
        </p>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <div className="text-muted-foreground">{t('envVarsCopyPreview')}</div>
          <div className="mt-1 font-mono">
            {varCount > 0 ? t('envVarsCopyPreviewVars', { count: varCount }) : null}
            {varCount > 0 && secretCount > 0 ? ' · ' : null}
            {secretCount > 0 ? t('envVarsCopyPreviewSecrets', { count: secretCount }) : null}
            {varCount === 0 && secretCount === 0 ? t('envVarsCopyPreviewEmpty') : null}
          </div>
          {secretCount > 0 ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {secretRefs.map((ref) => ref.name).join(', ')}
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium">{t('envVarsCopySelectTargets')}</div>
          {targets.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('envVarsCopyNoTargets')}</p>
          ) : (
            <div className="flex flex-wrap gap-3 text-xs">
              {targets.map((env) => (
                <Checkbox
                  key={env.id}
                  checked={selected.includes(env.id)}
                  onChange={(event) => toggle(env.id, event.target.checked)}
                  label={`${env.name} (${env.key})`}
                />
              ))}
            </div>
          )}
        </div>

        {result ? (
          <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-800/50 dark:bg-green-950/40 dark:text-green-300">
            {result}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function summarize(outcome: unknown, t: ProjectsTranslator): string {
  const data = outcome as { results?: Array<{ ok: boolean; key?: string; error?: string }> } | null;
  const results = data?.results ?? [];
  const ok = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);
  if (failed.length === 0) {
    return t('envVarsCopyDone', { ok: ok, total: results.length });
  }
  const reasons = failed
    .map((item) => `${item.key ?? '?'}: ${item.error ?? '?'}`)
    .join('; ');
  return `${t('envVarsCopyPartial', { ok: ok, total: results.length })} ${reasons}`;
}
