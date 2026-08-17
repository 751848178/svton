import { expect, type Page } from '@playwright/test';
import {
  captureEvidence,
  type BrowserDiagnostics,
  type EvidenceAssertions,
  type EvidenceRecord,
} from './shared-web-locale.evidence';

export interface TimelineLabels {
  code: 'en' | 'zh';
  html: 'en' | 'zh-CN';
  process: string;
  running: string;
  completed: string;
  failed: string;
  duration: string;
  exitCode17: string;
  send: string;
  commandCompleted: string;
  commandFailed: string;
  copyCommand: string;
  copyStdout: string;
  copyStderr: string;
  retry: string;
  openTerminal: string;
  terminalUnavailable: string;
  toolCompleted: string;
  copyResult: string;
  providerError: string;
  copyDiagnostic: string;
  fileSingle: string;
  fileAggregate: string;
  fileAggregateSummary: string;
  modify: string;
  create: string;
  copyPath: string;
  copyDiff: string;
  showDetails: string;
  openPath: string;
  pathUnavailableTitle: string;
  pathUnavailable: string;
  approvalDialog: string;
  approvalPending: string;
  approvalAllowed: string;
  approvalDeclined: string;
  approvalCancelled: string;
  approvalInterrupted: string;
  approvalTitle: string;
  allowOnce: string;
  decline: string;
  cancel: string;
  legacyOneFile: string;
  legacyTwoFiles: string;
  legacyFileTree: string;
  staleChrome: readonly string[];
}

export const timelineLabels: readonly TimelineLabels[] = [
  {
    code: 'en', html: 'en', process: 'Process', running: 'Running', completed: 'Completed',
    failed: 'Failed', duration: '1.3s', exitCode17: 'Exit code: 17', send: 'Send',
    commandCompleted: 'Command Completed', commandFailed: 'Command Failed',
    copyCommand: 'Copy Command', copyStdout: 'Copy stdout', copyStderr: 'Copy stderr',
    retry: 'Retry', openTerminal: 'Open terminal', terminalUnavailable: 'Terminal unavailable in this host',
    toolCompleted: 'list_files Completed', copyResult: 'Copy Result', providerError: 'Provider error',
    copyDiagnostic: 'Copy Diagnostic', fileSingle: 'File change Completed',
    fileAggregate: '2 file changes Completed', fileAggregateSummary: '2 files affected',
    modify: 'Modify', create: 'Create', copyPath: 'Copy Path', copyDiff: 'Copy Diff',
    showDetails: 'Show details', openPath: 'Open path',
    pathUnavailableTitle: 'Opening paths is unavailable in this host',
    pathUnavailable: 'Open unavailable in this host', approvalDialog: 'Approve this tool?',
    approvalPending: 'Waiting for approval', approvalAllowed: 'Allowed once',
    approvalDeclined: 'Declined', approvalCancelled: 'Cancelled', approvalInterrupted: 'Interrupted',
    approvalTitle: 'Approval requested for e2e_approval', allowOnce: 'Allow once', decline: 'Decline',
    cancel: 'Cancel',
    legacyOneFile: '1 file changed', legacyTwoFiles: '2 files changed', legacyFileTree: 'File Tree',
    staleChrome: ['命令：已完成', '命令：失败', 'list_files：已完成', '服务提供方错误',
      '文件变更：已完成', '2 个文件变更：已完成', '请求批准 e2e_approval'],
  },
  {
    code: 'zh', html: 'zh-CN', process: '过程', running: '执行中', completed: '已完成', failed: '失败',
    duration: '1.3 秒', exitCode17: '退出码：17', send: '发送',
    commandCompleted: '命令：已完成', commandFailed: '命令：失败', copyCommand: '复制命令',
    copyStdout: '复制标准输出', copyStderr: '复制标准错误', retry: '重新生成',
    openTerminal: '打开终端', terminalUnavailable: '当前客户端无法打开终端',
    toolCompleted: 'list_files：已完成', copyResult: '复制结果', providerError: '服务提供方错误',
    copyDiagnostic: '复制诊断', fileSingle: '文件变更：已完成', fileAggregate: '2 个文件变更：已完成',
    fileAggregateSummary: '影响 2 个文件', modify: '修改', create: '新建', copyPath: '复制路径',
    copyDiff: '复制差异', showDetails: '显示详情', openPath: '打开路径',
    pathUnavailableTitle: '当前客户端无法打开路径', pathUnavailable: '当前客户端无法打开',
    approvalDialog: '批准此工具？', approvalPending: '等待批准', approvalAllowed: '已允许一次',
    approvalDeclined: '已拒绝', approvalCancelled: '已取消', approvalInterrupted: '已中断',
    approvalTitle: '请求批准 e2e_approval', allowOnce: '仅允许一次', decline: '拒绝', cancel: '取消',
    legacyOneFile: '1 个文件变更',
    legacyTwoFiles: '2 个文件变更', legacyFileTree: '目录结构',
    staleChrome: ['Command Completed', 'Command Failed', 'list_files Completed', 'Provider error',
      'File change Completed', '2 file changes Completed', 'Approval requested for e2e_approval'],
  },
] as const;

export async function expectClipboard(page: Page, value: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(value);
}

export async function captureTimeline(
  page: Page,
  labels: TimelineLabels,
  scenario: string,
  diagnostics: BrowserDiagnostics,
  dom: string[],
  ax: string[],
): Promise<EvidenceRecord> {
  const assertions: EvidenceAssertions = {
    dom: ['no horizontal overflow', ...dom],
    focus: [], keyboard: [], status: [], live: [], error: [], ax,
  };
  return captureEvidence(page, labels.code, scenario, assertions, diagnostics);
}
