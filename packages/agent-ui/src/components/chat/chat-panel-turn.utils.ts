import type { ChatPanelMessage } from './ChatPanel';

export function isTurnBoundary(prev: ChatPanelMessage, curr: ChatPanelMessage): boolean {
  if (curr.role === 'system' || prev.role === 'system') return false;
  return prev.role !== curr.role;
}

export function buildSeparatorLabel(prevMsg?: ChatPanelMessage): string | undefined {
  if (!prevMsg || prevMsg.role !== 'assistant') return undefined;
  const parts: string[] = [];
  const duration = formatDuration(prevMsg.duration);
  if (duration) parts.push(duration);
  const usage = formatUsage(prevMsg.usage);
  if (usage) parts.push(usage);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function formatUsage(usage?: ChatPanelMessage['usage']): string | undefined {
  if (!usage || usage.totalTokens === 0) return undefined;
  const format = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
  return `${format(usage.promptTokens)} in → ${format(usage.completionTokens)} out`;
}

function formatDuration(ms?: number): string | undefined {
  if (!ms || ms < 60_000) return undefined;
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  if (minutes < 60) return `Worked for ${minutes}m ${remainder}s`;
  return `Worked for ${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
