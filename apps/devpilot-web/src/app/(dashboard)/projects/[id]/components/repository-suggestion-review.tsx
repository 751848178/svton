'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { Button } from '@/components/ui';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type { RepositorySuggestionDecision } from '../types/repository-analysis.types';
import {
  RepositorySuggestionRow,
  type RepositorySuggestionDraft,
} from './repository-suggestion-row';

export function RepositorySuggestionReview({ analysis }: { analysis: RepositoryAnalysisHook }) {
  const run = analysis.selectedRun;
  const suggestions = useMemo(() => run?.suggestions || [], [run?.suggestions]);
  const [drafts, setDrafts] = useState<Record<string, RepositorySuggestionDraft>>({});
  const [validationError, setValidationError] = useState('');
  const [reviewExpanded, setReviewExpanded] = useState(false);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        suggestions.map((item) => [
          item.id,
          {
            decision: item.reviewDecision || (item.status === 'rejected' ? 'reject' : undefined),
            value: JSON.stringify(item.reviewedValue ?? item.proposedValue, null, 2),
          },
        ]),
      ),
    );
    setValidationError('');
    setReviewExpanded(suggestions.some((item) => item.status === 'pending'));
  }, [run?.id, suggestions]);

  if (!run || run.status !== 'succeeded' || suggestions.length === 0) return null;
  const alreadyReviewed = suggestions.every((item) => item.status !== 'pending');
  const complete = suggestions.every((item) => drafts[item.id]?.decision);

  const apply = async () => {
    try {
      const decisions: RepositorySuggestionDecision[] = suggestions.map((item) => {
        const draft = drafts[item.id];
        if (!draft?.decision) throw new Error('请处理全部建议');
        return {
          suggestionId: item.id,
          decision: draft.decision,
          value:
            draft.decision === 'edit'
              ? (JSON.parse(draft.value) as Record<string, unknown>)
              : undefined,
        };
      });
      setValidationError('');
      await analysis.apply(run.id, decisions);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <details
      className="group border-t"
      open={reviewExpanded}
      onToggle={(event) => setReviewExpanded(event.currentTarget.open)}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3">
        <span>
          <span className="block text-sm font-semibold">识别到的变更</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {alreadyReviewed ? '已完成审核' : `${suggestions.length} 条建议待确认`}
          </span>
        </span>
        <CaretDown
          size={16}
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="pb-4">
        <p className="text-sm text-muted-foreground">
          系统根据当前分支与 commit
          识别组件、配置和资源变化，但不会直接修改项目。确认后才更新平台对象，并把变更来源保留在项目组件列表中。
        </p>
        <div className="mt-4 divide-y border-y">
          {suggestions.map((item) => (
            <RepositorySuggestionRow
              key={item.id}
              item={item}
              draft={drafts[item.id]}
              disabled={alreadyReviewed || analysis.mutating}
              onChange={(draft) => setDrafts((current) => ({ ...current, [item.id]: draft }))}
            />
          ))}
        </div>
        {validationError ? (
          <p className="mt-3 text-sm text-destructive">{validationError}</p>
        ) : null}
        {!alreadyReviewed ? (
          <Button
            className="mt-3"
            disabled={!complete || analysis.mutating}
            onClick={() => void apply()}
          >
            {analysis.mutating ? '正在应用…' : `应用 ${suggestions.length} 条审核结果`}
          </Button>
        ) : (
          <p className="mt-3 text-sm font-medium text-emerald-700">这次运行的建议已完成审核。</p>
        )}
        {analysis.applyResult ? (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="font-medium">
              {analysis.applyResult.complete
                ? '仓库交付配置已完整应用'
                : '建议已处理，但必需项被忽略'}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              {analysis.applyResult.references.flatMap((reference) =>
                reference.links.map((link) => (
                  <Link
                    key={`${reference.suggestionId}-${link.href}`}
                    href={link.href}
                    className="text-primary hover:underline"
                  >
                    {link.label}
                  </Link>
                )),
              )}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
