import { createTranslator } from '@svton/ui';
import { describe, expect, it } from 'vitest';
import {
  approvalTitle,
  durationLabel,
  executionTitle,
} from '../src/components/timeline/timeline-execution-copy';
import {
  fileOutcomeSummary,
  fileOutcomeTitle,
} from '../src/components/timeline/timeline-file-copy';
import { timelineStatusKey } from '../src/components/timeline/timeline-status-copy';
import type {
  FileOutcomeItemView,
  TimelineStatusView,
  ToolExecutionItemView,
} from '../src/components/timeline/timeline.types';

const en = createTranslator('en');
const zh = createTranslator('zh');
const number = (value: number, options?: Intl.NumberFormatOptions) => (
  new Intl.NumberFormat('en', options).format(value)
);

describe('timeline semantic copy', () => {
  it('maps every typed item status without a raw fallback', () => {
    const statuses: TimelineStatusView[] = [
      'pending', 'running', 'awaitingApproval', 'completed',
      'failed', 'declined', 'cancelled', 'interrupted',
    ];
    expect(statuses.map(timelineStatusKey)).toEqual([
      'timeline.status.pending', 'timeline.status.running',
      'timeline.status.awaitingApproval', 'timeline.status.completed',
      'timeline.status.failed', 'timeline.status.declined',
      'timeline.status.cancelled', 'timeline.status.interrupted',
    ]);
  });

  it('derives execution and approval titles from typed fields, not stored titles', () => {
    const item: ToolExecutionItemView = {
      id: 'call', sessionId: 'session', turnId: 'turn', kind: 'toolExecution',
      lane: 'outcome', status: 'completed', title: 'STALE ENGLISH', revision: 0,
      toolName: 'list_动态', arguments: {}, progress: [], result: 'raw-result',
    };
    expect(executionTitle(item, en)).toBe('list_动态 Completed');
    expect(executionTitle(item, zh)).toBe('list_动态：已完成');
    expect(approvalTitle('deploy_动态', zh)).toBe('请求批准 deploy_动态');
  });

  it('formats duration thresholds without changing numeric meaning', () => {
    expect(durationLabel(999, en, number)).toBe('999ms');
    expect(durationLabel(1000, en, number)).toBe('1.0s');
    expect(durationLabel(1000, zh, number)).toBe('1.0 秒');
  });

  it('derives file chrome while preserving exact path bytes', () => {
    const single = fileItem();
    expect(fileOutcomeTitle(single, zh, number)).toBe('文件变更：已完成');
    expect(fileOutcomeSummary(single, zh, number)).toBe('修改 /动态/exact.ts');
    const aggregate = { ...single, scope: 'turn' as const, changes: [
      single.changes[0]!, { ...single.changes[0]!, sourceCallId: 'call-2', changeType: 'create' as const },
    ] };
    expect(fileOutcomeTitle(aggregate, en, number)).toBe('2 file changes Completed');
    expect(fileOutcomeSummary(aggregate, zh, number)).toBe('影响 2 个文件');
  });
});

function fileItem(): FileOutcomeItemView {
  return {
    id: 'file', sessionId: 'session', turnId: 'turn', kind: 'fileOutcome',
    scope: 'file', sourceCallIds: ['call-1'], lane: 'outcome', status: 'completed',
    title: 'STALE ENGLISH', summary: 'STALE SUMMARY', revision: 0,
    changes: [{
      sourceCallId: 'call-1', path: '/动态/exact.ts', changeType: 'modify',
      status: 'completed', diff: '+动态\n-old',
    }],
  };
}
