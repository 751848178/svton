/**
 * 「从 .env 导入」弹窗
 *
 * 单一职责：用户粘贴 .env 文本，本组件解析为 KEY=VALUE 记录并预览，
 * 确认后通过 onImport(parsedVars) 把解析结果合并进父级 draft。
 *
 * 不落库、不感知 saving —— 合并只命中父级暂存区，与 staged changes 设计一致。
 *
 * 解析逻辑见 utils/env-file-parser.utils.ts。无效 KEY / 重复 KEY 仅提示，不阻断预览
 * （让用户在编辑行内修正，或选择丢弃）。
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Textarea } from '@svton/ui';
import { parseEnvText, isValidEnvKeyStrict } from '../utils/env-file-parser.utils';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentEnvImportModalProps {
  open: boolean;
  onClose: () => void;
  /** 已存在的 KEY（用于高亮冲突），可选。 */
  existingKeys?: Set<string>;
  onImport: (vars: Record<string, string>) => void;
  t: ProjectsTranslator;
}

export function EnvironmentEnvImportModal({
  open,
  onClose,
  existingKeys,
  onImport,
  t,
}: EnvironmentEnvImportModalProps) {
  const tc = useTranslations('common');
  const [text, setText] = useState('');

  // 每次打开重置输入，避免上一次残留。
  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const parsed = useMemo(() => (text.trim() === '' ? null : parseEnvText(text)), [text]);

  const validKeys = parsed
    ? Object.keys(parsed.vars).filter((k) => isValidEnvKeyStrict(k)).length
    : 0;
  const dupKeys = parsed ? Object.keys(parsed.duplicates).length : 0;
  const conflictKeys = parsed && existingKeys
    ? Object.keys(parsed.vars).filter((k) => existingKeys.has(k)).length
    : 0;

  const canImport = parsed !== null && validKeys > 0;

  const handleConfirm = () => {
    if (!parsed) return;
    // 只导入合法 KEY 的项；非法 KEY 留给行内编辑修正（已在预览中提示）。
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.vars)) {
      if (isValidEnvKeyStrict(k)) clean[k] = v;
    }
    if (Object.keys(clean).length === 0) return;
    onImport(clean);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('envImportTitle')}
      width={620}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canImport}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t('envImportConfirm')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('envImportHint')}</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('envImportPlaceholder')}
          className="min-h-[180px] font-mono text-xs"
          autoFocus
        />
        {parsed ? (
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              {t('envImportParsedSummary', { valid: validKeys, total: parsed.entries.length })}
            </p>
            {parsed.invalidCount > 0 ? (
              <p className="text-destructive">
                {t('envImportInvalidLines', { count: parsed.invalidCount })}
              </p>
            ) : null}
            {dupKeys > 0 ? (
              <p className="text-yellow-700 dark:text-yellow-500">
                {t('envImportDuplicates', { keys: dupKeys })}
              </p>
            ) : null}
            {conflictKeys > 0 ? (
              <p className="text-yellow-700 dark:text-yellow-500">
                {t('envImportConflicts', { count: conflictKeys })}
              </p>
            ) : null}
            {validKeys > 0 ? (
              <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto rounded-md border bg-muted/30 p-2">
                {Object.entries(parsed.vars)
                  .filter(([k]) => isValidEnvKeyStrict(k))
                  .slice(0, 50)
                  .map(([k, v]) => (
                    <li key={k} className="flex items-baseline gap-2 font-mono">
                      <span className={existingKeys?.has(k) ? 'text-yellow-700 dark:text-yellow-500' : 'text-foreground'}>
                        {k}
                      </span>
                      <span className="text-muted-foreground">=</span>
                      <span className="truncate text-muted-foreground">{v || '(empty)'}</span>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
