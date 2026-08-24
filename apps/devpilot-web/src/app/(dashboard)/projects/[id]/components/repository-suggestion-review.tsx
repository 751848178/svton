'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@svton/ui';
import { Button, Radio, RadioGroup, Textarea } from '@/components/ui';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type {
  RepositoryAnalysisSuggestion,
  RepositorySuggestionDecision,
} from '../types/repository-analysis.types';
import { RepositorySuggestionReadableValue } from './repository-suggestion-readable-value';

type DraftDecision = {
  decision?: 'accept' | 'edit' | 'reject';
  value: string;
};

export function RepositorySuggestionReview({ analysis }: { analysis: RepositoryAnalysisHook }) {
  const run = analysis.selectedRun;
  const suggestions = useMemo(() => run?.suggestions || [], [run?.suggestions]);
  const [drafts, setDrafts] = useState<Record<string, DraftDecision>>({});
  const [validationError, setValidationError] = useState('');

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
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">确认组件与配置变更</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          系统根据当前分支与 commit
          识别组件、配置和资源变化，但不会直接修改项目。确认后才更新平台对象，并把变更来源保留在项目组件列表中。
        </p>
      </div>
      {suggestions.map((item) => (
        <SuggestionCard
          key={item.id}
          item={item}
          draft={drafts[item.id]}
          disabled={alreadyReviewed || analysis.mutating}
          onChange={(draft) => setDrafts((current) => ({ ...current, [item.id]: draft }))}
        />
      ))}
      {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}
      {!alreadyReviewed ? (
        <Button
          disabled={!complete || analysis.mutating}
          onClick={() => void apply()}
        >
          {analysis.mutating ? '正在应用…' : `应用 ${suggestions.length} 条审核结果`}
        </Button>
      ) : (
        <p className="text-sm font-medium text-emerald-700">这次运行的建议已完成审核。</p>
      )}
      {analysis.applyResult ? (
        <Card className="space-y-2 border-emerald-500/30">
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
        </Card>
      ) : null}
    </section>
  );
}

function SuggestionCard({
  item,
  draft,
  disabled,
  onChange,
}: {
  item: RepositoryAnalysisSuggestion;
  draft?: DraftDecision;
  disabled: boolean;
  onChange: (draft: DraftDecision) => void;
}) {
  const value = draft || { value: JSON.stringify(item.proposedValue, null, 2) };
  return (
    <Card className={item.conflict ? 'border-amber-500/40' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{kindLabel(item.kind)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.impact}</p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-xs">
          {/* INFO-6：置信度枚举本地化，不再中英混排。 */}
          {confidenceLabel(item.confidence)}
          {item.conflict ? ' · 有冲突' : ''}
        </span>
      </div>
      <RepositorySuggestionReadableValue item={item} />
      {item.warnings?.length ? (
        <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
          {item.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <RadioGroup className="mt-3 gap-4 text-sm">
        {(['accept', 'edit', 'reject'] as const).map((decision) => (
          <Radio
            key={decision}
            name={`decision-${item.id}`}
            checked={value.decision === decision}
            disabled={disabled}
            onChange={() => onChange({ ...value, decision })}
            label={{ accept: '接受', edit: '编辑后接受', reject: '忽略' }[decision]}
          />
        ))}
      </RadioGroup>
      {value.decision === 'edit' ? (
        <Textarea
          className="mt-3 min-h-40 font-mono text-xs"
          value={value.value}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, value: event.target.value })}
        />
      ) : null}
    </Card>
  );
}

function confidenceLabel(confidence: string): string {
  return { high: '高置信', medium: '中置信', low: '低置信' }[confidence] || confidence;
}

function kindLabel(kind: string): string {
  return (
    {
      project_repository: '项目仓库来源',
      environment: '项目环境',
      application_service: '应用与服务',
      resource_requirement: '资源需求',
    }[kind] || kind
  );
}
