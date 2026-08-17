import { expect, type Page } from '@playwright/test';
import { enqueueResponses, lastAssistant, responses, send } from './helpers';
import type { BrowserDiagnostics, EvidenceRecord } from './shared-web-locale.evidence';
import {
  captureTimeline,
  expectClipboard,
  type TimelineLabels,
} from './shared-web-locale.timeline.support';

const providerDiagnostic = 'Provider stream failed (simulated)';

export async function runTimelineExecutionScenarios(
  page: Page,
  labels: TimelineLabels,
  diagnostics: BrowserDiagnostics,
): Promise<EvidenceRecord[]> {
  const records: EvidenceRecord[] = [];
  await enqueueResponses(page, [
    responses.toolCallWithId('e2e_command', {
      command: 'printf 动态-command', stdout: 'stdout-动态-byte', stderr: '', exitCode: 0,
      progressText: 'progress-动态-byte', durationMs: 1250,
    }, 'uiimpl024-command-success'),
    responses.text('command complete settled'),
  ]);
  await send(page, 'run exact localized command lifecycle');
  const running = lastAssistant(page).getByTestId('timeline-process');
  await expect(running).toContainText(labels.process, { timeout: 20_000 });
  await expect(running.getByTestId('timeline-progress-update')).toHaveText('progress-动态-byte two');
  const completed = lastAssistant(page).getByTestId('timeline-command-uiimpl024-command-success');
  await expect(completed).toHaveAttribute('data-timeline-status', 'completed', { timeout: 20_000 });
  await expect(completed).toContainText(labels.commandCompleted);
  await expect(completed.getByTestId('command-value')).toHaveText('printf 动态-command');
  await expect(completed.getByTestId('command-stdout')).toHaveText('stdout-动态-byte');
  await expect(completed.getByTestId('command-duration')).toHaveText(labels.duration);
  await completed.getByRole('button', { name: labels.copyCommand }).click();
  await expectClipboard(page, 'printf 动态-command');
  await completed.getByRole('button', { name: labels.copyStdout }).click();
  await expectClipboard(page, 'stdout-动态-byte');
  const terminal = completed.getByRole('button', { name: labels.openTerminal });
  await expect(terminal).toBeDisabled();
  await expect(terminal).toHaveAttribute('title', labels.terminalUnavailable);
  await expect(lastAssistant(page).getByTestId('timeline-process')).toHaveCount(0);
  await expect(lastAssistant(page).getByTestId('tool-card-e2e_command')).toHaveCount(0);
  await expect(page.getByTestId('send-button')).toBeVisible();
  await expect(page.getByTestId('chat-input')).toBeEnabled();
  records.push(await captureTimeline(page, labels, 'timeline-command-complete', diagnostics,
    ['running progress became one terminal command', 'raw command and stdout preserved',
      'no stale process or legacy command card'], [labels.commandCompleted, 'stdout-动态-byte']));

  await enqueueResponses(page, [
    responses.toolCallWithId('e2e_command', {
      command: 'exit 17 动态-command', stdout: '', stderr: 'stderr-动态-byte', exitCode: 17,
      progressText: 'failed-progress-动态-byte', durationMs: 1250,
    }, 'uiimpl024-command-fail'),
    responses.text('command failure settled'),
  ]);
  await send(page, 'retry owns this exact user prompt');
  const failed = lastAssistant(page).getByTestId('timeline-command-uiimpl024-command-fail');
  await expect(failed).toHaveAttribute('data-timeline-status', 'failed', { timeout: 20_000 });
  await expect(failed).toContainText(labels.commandFailed);
  await expect(failed.getByTestId('command-stderr')).toHaveText('stderr-动态-byte');
  await expect(failed.getByTestId('command-exit-code')).toHaveText(labels.exitCode17);
  await expect(failed.getByTestId('command-duration')).toHaveText(labels.duration);
  await failed.getByRole('button', { name: labels.copyStderr }).click();
  await expectClipboard(page, 'stderr-动态-byte');
  await expect(lastAssistant(page).getByTestId('timeline-process')).toHaveCount(0);
  await expect(page.getByTestId('send-button')).toBeVisible();
  await expect(page.getByTestId('chat-input')).toBeEnabled();
  const userCount = await page.getByTestId('message-user').count();
  await enqueueResponses(page, [
    responses.toolCallWithId('e2e_command', {
      command: 'printf retry-动态', stdout: 'retry-stdout-动态-byte', stderr: '', exitCode: 0,
    }, 'uiimpl024-command-retry'),
    responses.text('command retry settled'),
  ]);
  await failed.getByRole('button', { name: labels.retry }).click();
  await expect(page.getByTestId('message-user')).toHaveCount(userCount);
  const retried = page.getByTestId('timeline-command-uiimpl024-command-retry');
  await expect(retried).toHaveAttribute('data-timeline-status', 'completed', { timeout: 20_000 });
  await expect(retried.getByTestId('command-stdout')).toHaveText('retry-stdout-动态-byte');
  await expect(page.getByTestId('send-button')).toBeVisible();
  await expect(page.getByTestId('chat-input')).toBeEnabled();
  records.push(await captureTimeline(page, labels, 'timeline-command-retry', diagnostics,
    ['failed command retained exact stderr', 'retry reused owning user prompt',
      'retry produced a distinct completed command'], [labels.commandCompleted, 'retry-stdout-动态-byte']));

  const tree = JSON.stringify([{ name: '/动态/timeline/tree.ts', type: 'file' }]);
  await enqueueResponses(page, [
    responses.toolCallWithId('list_files', {
      tree: [{ name: '/动态/timeline/tree.ts', type: 'file' }],
    }, 'uiimpl024-tool-tree'),
    responses.text('generic tool settled'),
  ]);
  await send(page, 'render exact generic tool outcome');
  const tool = lastAssistant(page).getByTestId('timeline-tool-uiimpl024-tool-tree');
  await expect(tool).toHaveAttribute('data-timeline-status', 'completed', { timeout: 20_000 });
  await expect(tool).toContainText(labels.toolCompleted);
  await expect(tool.getByTestId('tool-result')).toHaveText(tree);
  await tool.getByRole('button', { name: labels.copyResult }).click();
  await expectClipboard(page, tree);
  await expect(lastAssistant(page).getByTestId('timeline-process')).toHaveCount(0);
  await expect(lastAssistant(page).getByTestId('tool-card-list_files')).toHaveCount(0);
  await expect(lastAssistant(page).getByText(labels.legacyFileTree, { exact: true })).toHaveCount(0);
  records.push(await captureTimeline(page, labels, 'timeline-tool-result', diagnostics,
    ['typed tool owns list_files result bytes', 'legacy tool and file tree absent'],
    [labels.toolCompleted, '/动态/timeline/tree.ts']));

  await enqueueResponses(page, [responses.error()]);
  await send(page, 'render exact provider failure');
  const outcome = lastAssistant(page).getByTestId('timeline-error');
  await expect(outcome).toContainText(labels.providerError, { timeout: 20_000 });
  await expect(outcome.getByTestId('message-error')).toHaveText(providerDiagnostic);
  await outcome.getByRole('button', { name: labels.copyDiagnostic }).click();
  await expectClipboard(page, providerDiagnostic);
  await expect(lastAssistant(page).getByTestId('timeline-process')).toHaveCount(0);
  await expect(lastAssistant(page).getByRole('alert')).toHaveCount(0);
  records.push(await captureTimeline(page, labels, 'timeline-provider-outcome', diagnostics,
    ['provider diagnostic preserved verbatim', 'one typed error without process or alert duplicate'],
    [labels.providerError, providerDiagnostic]));
  return records;
}
