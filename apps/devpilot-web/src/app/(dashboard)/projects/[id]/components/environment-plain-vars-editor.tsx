/**
 * 普通环境变量编辑器（KEY=VALUE 行）
 *
 * 单一职责：渲染可增删改的普通变量行，并提供保存按钮。
 * 数据落库由父级传入的 onSave（PUT /project-environments/:id）完成。
 * 行的增删改命中父级持有的 draft（onAdd/onRemove/onUpdate）。
 */
'use client';

import { useTranslations } from 'next-intl';
import { Button, Input } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { isValidEnvKey } from '../hooks/use-environment-env-vars';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentPlainVarsEditorProps {
  rows: Array<[string, string]>;
  saving: boolean;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (oldKey: string, field: 'key' | 'value', val: string) => void;
  /** 打开「从 .env 导入」弹窗。 */
  onImportEnv: () => void;
  onSave: () => Promise<void>;
  blockedReason?: string;
  t: ProjectsTranslator;
}

export function EnvironmentPlainVarsEditor({
  rows,
  saving,
  onAdd,
  onRemove,
  onUpdate,
  onImportEnv,
  onSave,
  blockedReason,
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
              <li
                key={idx}
                className="flex items-center gap-2"
              >
                <Input
                  size="sm"
                  className="w-2/5 font-mono"
                  value={key}
                  invalid={!keyValid}
                  onChange={(e) => onUpdate(key, 'key', e.target.value)}
                  placeholder={t('envVarsKeyPlaceholder')}
                />
                <span className="text-muted-foreground">=</span>
                <Input
                  size="sm"
                  className="w-2/5 font-mono"
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
        >
          {t('envVarsAdd')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onImportEnv}
        >
          {t('importFromEnv')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving || hasInvalidKey || Boolean(blockedReason)}
          title={hasInvalidKey ? t('envVarsInvalidKeyHint') : blockedReason}
        >
          {saving ? t('envVarsSaving') : t('envVarsSave')}
        </Button>
      </div>
      {hasInvalidKey ? (
        <p className="text-xs text-destructive">{t('envVarsInvalidKeyHint')}</p>
      ) : null}
      {blockedReason ? <p className="text-xs text-destructive">{blockedReason}</p> : null}
    </div>
  );
}
