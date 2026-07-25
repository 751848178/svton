/**
 * 查询结果表（脱敏）。
 *
 * 单一职责：把 resource-query run 的 `result.preview` 渲染为结果表，对齐 A1
 * reveal-on-click 脱敏基线。命中 redaction.maskedColumnKeys / column.masked 的列
 * 默认显示掩码，点击「显示」切换为已持久化的值 + 复制。
 *
 * 设计要点：
 *  - 按 preview.columns 渲染表头、preview.rows 渲染表体（rows 即后端 maskQueryPreviewRow
 *    处理后的脱敏快照，敏感列已是 '******'）；
 *  - 脱敏判定 = column.masked || redaction.maskedColumnKeys?.includes(column.key)，
 *    与后端 redaction 标记保持一致（前端按 redaction 标记决定遮罩）；
 *  - reveal 是纯前端 toggle；当持久化值是 '******'（服务端已脱敏）时如实标注，
 *    不伪造明文（后端无明文存储、无 plaintext 接口，且不动后端契约）。
 *  - 复合键 `${runId}:${rowIdx}:${col.key}` 保证多行/多列互不串扰。
 */
'use client';

import { useTranslations } from 'next-intl';
import { useSetState, usePersistFn } from '@svton/hooks';
import { Copyable, EmptyState } from '@svton/ui';
import type { QueryResultPreview } from '../types-query';

/** 服务端脱敏占位（maskQueryPreviewRow 写入的固定字面量）。 */
const SERVER_REDACTED = '******';

export interface QueryResultTableProps {
  preview?: QueryResultPreview | null;
  runId: string;
}

/** 查询结果表：无 preview → EmptyState；有 columns/rows → 表格。 */
export function QueryResultTable({ preview, runId }: QueryResultTableProps) {
  const t = useTranslations('resourceControl');
  const [revealed, setRevealed] = useSetState<Record<string, string>>({});
  if (!preview) {
    return <EmptyState text={t('noResult')} />;
  }
  const columns = preview.columns ?? [];
  const rows = preview.rows ?? [];
  const maskedKeys = preview.redaction?.maskedColumnKeys ?? [];
  if (columns.length === 0 || rows.length === 0) {
    return <EmptyState text={t('noResult')} />;
  }
  return (
    <div className="mt-2 overflow-x-auto rounded border bg-background">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="border-b px-2 py-1.5 text-left font-medium"
              >
                <span>{col.label}</span>
                {col.masked || maskedKeys.includes(col.key) ? (
                  <span className="ml-1 text-muted-foreground">🔒</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="odd:bg-background"
            >
              {columns.map((col) => {
                const isMasked = col.masked || maskedKeys.includes(col.key);
                const raw = row[col.key];
                return (
                  <td
                    key={col.key}
                    className="border-b px-2 py-1 align-top"
                  >
                    {isMasked ? (
                      <MaskedCell
                        runId={runId}
                        rowIdx={rowIdx}
                        colKey={col.key}
                        text={raw === null || raw === undefined ? '' : String(raw)}
                        revealed={revealed}
                        setRevealed={setRevealed}
                      />
                    ) : (
                      <span className="break-all font-mono">
                        {raw === null || raw === undefined ? '-' : String(raw)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 脱敏单元格：默认显示掩码，reveal 切换显示已持久化值 + 复制。
 * 当持久化值是服务端脱敏占位 '******' 时，reveal 后如实标注「服务端已脱敏」。
 */
function MaskedCell({
  runId,
  rowIdx,
  colKey,
  text,
  revealed,
  setRevealed,
}: {
  runId: string;
  rowIdx: number;
  colKey: string;
  text: string;
  revealed: Record<string, string>;
  setRevealed: (patch: Partial<Record<string, string>>) => void;
}) {
  const t = useTranslations('resourceControl');
  const compositeKey = `${runId}:${rowIdx}:${colKey}`;
  const isRevealed = Boolean(revealed[compositeKey]);
  const isServerRedacted = text === SERVER_REDACTED;
  const toggle = usePersistFn(() => {
    setRevealed({ [compositeKey]: isRevealed ? '' : text });
  });
  if (!text) {
    return <span className="font-mono">-</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      {isRevealed ? (
        <>
          <Copyable
            text={text}
            copyText={t('copy')}
            copiedText={t('copied')}
          >
            <code className="block break-all font-mono">{text}</code>
          </Copyable>
          {isServerRedacted ? (
            <span className="text-[10px] text-muted-foreground">
              {t('redactedServerSide')}
            </span>
          ) : null}
        </>
      ) : (
        <code className="font-mono">{t('maskedValue')}</code>
      )}
      <button
        type="button"
        onClick={toggle}
        className="rounded px-1.5 py-0.5 text-primary hover:bg-primary/10"
      >
        {isRevealed ? t('hide') : t('reveal')}
      </button>
    </span>
  );
}
