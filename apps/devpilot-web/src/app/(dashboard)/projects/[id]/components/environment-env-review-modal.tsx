/**
 * 「Review & Deploy」弹窗
 *
 * 单一职责：展示暂存区相对已落库 vars 的 diff（新增/修改/删除），
 * 确认后调用 onDeploy()（一次性落库）。
 *
 * diff 计算见 utils/env-var-diff.utils.ts。本组件不感知 saving 状态，
 * 落库在途由父级通过 deploying 透传给 footer 按钮。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@svton/ui';
import type { EnvVarChange } from '../utils/env-var-diff.utils';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentEnvReviewModalProps {
  open: boolean;
  onClose: () => void;
  changes: EnvVarChange[];
  deploying: boolean;
  onDeploy: () => void;
  t: ProjectsTranslator;
}

export function EnvironmentEnvReviewModal({
  open,
  onClose,
  changes,
  deploying,
  onDeploy,
  t,
}: EnvironmentEnvReviewModalProps) {
  const tc = useTranslations('common');
  const added = changes.filter((c) => c.kind === 'added');
  const modified = changes.filter((c) => c.kind === 'modified');
  const removed = changes.filter((c) => c.kind === 'removed');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('reviewAndDeploy')}
      width={640}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={deploying}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={onDeploy}
            disabled={deploying || changes.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {deploying ? t('envVarsSaving') : t('deploy')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('reviewAndDeployHint', { count: changes.length })}
        </p>

        {added.length > 0 ? (
          <DiffGroup
            label={t('diffAdded')}
            badge={added.length}
            tone="added"
            items={added}
            t={t}
          />
        ) : null}
        {modified.length > 0 ? (
          <DiffGroup
            label={t('diffModified')}
            badge={modified.length}
            tone="modified"
            items={modified}
            t={t}
          />
        ) : null}
        {removed.length > 0 ? (
          <DiffGroup
            label={t('diffRemoved')}
            badge={removed.length}
            tone="removed"
            items={removed}
            t={t}
          />
        ) : null}

        {changes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('stagedEmpty')}</p>
        ) : null}
      </div>
    </Modal>
  );
}

type DiffTone = 'added' | 'modified' | 'removed';

interface DiffGroupProps {
  label: string;
  badge: number;
  tone: DiffTone;
  items: EnvVarChange[];
  t: ProjectsTranslator;
}

const TONE_BADGE: Record<DiffTone, string> = {
  added: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  modified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  removed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function DiffGroup({ label, badge, tone, items, t }: DiffGroupProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{label}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TONE_BADGE[tone]}`}>
          {badge}
        </span>
      </div>
      <ul className="space-y-0.5 rounded-md border bg-muted/30 p-2 font-mono text-xs">
        {items.map((c) => (
          <li key={`${c.kind}:${c.key}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium">{c.key}</span>
            {c.kind === 'added' ? (
              <span className="text-green-700 dark:text-green-400">
                + {c.newValue || '(empty)'}
              </span>
            ) : c.kind === 'modified' ? (
              <>
                <span className="text-muted-foreground line-through">
                  {c.oldValue || '(empty)'}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="text-blue-700 dark:text-blue-400">
                  {c.newValue || '(empty)'}
                </span>
              </>
            ) : (
              <span className="text-red-700 dark:text-red-400 line-through">
                - {c.oldValue || '(empty)'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
