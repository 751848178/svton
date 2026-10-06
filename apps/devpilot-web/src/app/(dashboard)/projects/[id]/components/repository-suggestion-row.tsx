'use client';

import React from 'react';
import { Radio, RadioGroup, Textarea } from '@/components/ui';
import type { RepositoryAnalysisSuggestion } from '../types/repository-analysis.types';
import { RepositorySuggestionReadableValue } from './repository-suggestion-readable-value';

export type RepositorySuggestionDraft = {
  decision?: 'accept' | 'edit' | 'reject';
  value: string;
};

export function RepositorySuggestionRow({
  item,
  draft,
  disabled,
  onChange,
}: {
  item: RepositoryAnalysisSuggestion;
  draft?: RepositorySuggestionDraft;
  disabled: boolean;
  onChange: (draft: RepositorySuggestionDraft) => void;
}) {
  const value = draft || { value: JSON.stringify(item.proposedValue, null, 2) };
  return (
    <article className={`py-4 first:pt-0 last:pb-0 ${item.conflict ? 'text-amber-950' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{kindLabel(item.kind)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.impact}</p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-xs">
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
    </article>
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
