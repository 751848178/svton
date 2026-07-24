/**
 * 普通环境变量编辑器（KEY=VALUE 行）
 *
 * 单一职责：渲染可增删改的普通变量行，并提供保存按钮。
 * 数据落库由父级传入的 onSave（PUT /project-environments/:id）完成。
 * 行的增删改命中父级持有的 draft（onAdd/onRemove/onUpdate）。
 */
'use client';

import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import { isValidEnvKey } from '../hooks/use-environment-env-vars';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentPlainVarsEditorProps {
  rows: Array<[string, string]>;
  saving: boolean;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (oldKey: string, field: 'key' | 'value', val: string) => void;
  onSave: () => Promise<void>;
  t: ProjectsTranslator;
}

export function EnvironmentPlainVarsEditor({
  rows,
  saving,
  onAdd,
  onRemove,
  onUpdate,
  onSave,
  t,
}: EnvironmentPlainVarsEditorProps) {
  // 是否存在无效 KEY —— 有则禁用保存并提示,避免静默丢弃(架构师 B1)。
  const hasInvalidKey = rows.some(([k]) => !isValidEnvKey(k));

  const handleSave = async () => {
    try {
      await onSave();
      feedback.success(t('envVarsSaveSuccess'));
    } catch (err) {
      feedback.error(t('envVarsSaveFailed'), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('envVarsPlainHint')}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('envVarsPlainEmpty')}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(([key, value], idx) => {
            const keyValid = isValidEnvKey(key);
            return (
              <li key={idx} className="flex items-center gap-2">
                <input
                  className="w-2/5 rounded-md border px-2 py-1 font-mono text-xs aria-[invalid=true]:border-destructive"
                  value={key}
                  aria-invalid={!keyValid}
                  onChange={(e) => onUpdate(key, 'key', e.target.value)}
                  placeholder={t('envVarsKeyPlaceholder')}
                />
                <span className="text-muted-foreground">=</span>
                <input
                  className="w-2/5 rounded-md border px-2 py-1 font-mono text-xs"
                  value={value}
                  onChange={(e) => onUpdate(key, 'value', e.target.value)}
                  placeholder={t('envVarsValuePlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => onRemove(key)}
                  className="shrink-0 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  {t('envVarsRemove')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
        >
          {t('envVarsAdd')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasInvalidKey}
          title={hasInvalidKey ? t('envVarsInvalidKeyHint') : undefined}
          className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? t('envVarsSaving') : t('envVarsSave')}
        </button>
      </div>
      {hasInvalidKey ? (
        <p className="text-xs text-destructive">{t('envVarsInvalidKeyHint')}</p>
      ) : null}
    </div>
  );
}
