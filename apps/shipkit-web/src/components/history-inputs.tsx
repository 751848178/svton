import { ChevronRight } from 'lucide-react';
import type { HistoryItem } from '@/lib/contracts';
import { ConfigReference } from './config-reference';
import { SourceReference } from './source-reference';

export function HistoryInputs({ item }: { item: HistoryItem }) {
  if (!item.services || !Object.keys(item.services).length) return null;
  return <details className="history-inputs"><summary><ChevronRight size={14} aria-hidden="true" />服务源码与配置</summary><div className="history-input-list">{Object.entries(item.services).map(([key, service]) => <div key={key}><strong>{key}</strong><p><ConfigReference value={service.configRef} /></p><SourceReference value={service.source} /></div>)}</div></details>;
}
