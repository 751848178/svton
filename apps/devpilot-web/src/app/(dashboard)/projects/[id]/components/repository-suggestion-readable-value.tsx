import React from 'react';
import type { RepositoryAnalysisSuggestion } from '../types/repository-analysis.types';
import { repositorySuggestionFacts } from './repository-suggestion-summary.model';

export function RepositorySuggestionReadableValue({
  item,
}: {
  item: RepositoryAnalysisSuggestion;
}) {
  const value =
    item.status === 'pending' ? item.proposedValue : (item.reviewedValue ?? item.proposedValue);
  const facts = repositorySuggestionFacts(item);
  return (
    <>
      <dl className="mt-3 grid gap-2 rounded bg-muted/50 p-3 text-sm sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={`${fact.labelKey}-${fact.value}`}>
            <dt className="text-xs text-muted-foreground">{summaryLabel(fact.labelKey)}</dt>
            <dd className="mt-0.5 break-all font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-3 rounded border text-xs">
        <summary className="min-h-9 cursor-pointer px-3 py-2 font-medium text-primary">
          技术证据：查看原始建议
        </summary>
        <pre className="max-h-44 overflow-auto border-t bg-muted p-3">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    </>
  );
}

function summaryLabel(key: string) {
  return LABELS[key] || key;
}

const LABELS: Record<string, string> = {
  repositorySuggestionFactRepository: '仓库',
  repositorySuggestionFactBranch: '分支',
  repositorySuggestionFactCommit: 'Commit',
  repositorySuggestionFactEnvironment: '环境',
  repositorySuggestionFactStatus: '状态',
  repositorySuggestionFactComponent: '组件',
  repositorySuggestionFactPath: '仓库目录',
  repositorySuggestionFactRuntime: '运行时',
  repositorySuggestionFactPorts: '端口',
  repositorySuggestionFactBuild: '构建命令',
  repositorySuggestionFactStart: '启动命令',
  repositorySuggestionFactResources: '资源需求',
  repositorySuggestionFactKey: '建议标识',
};
