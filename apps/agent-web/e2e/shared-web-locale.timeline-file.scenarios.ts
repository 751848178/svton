import { expect, type Page } from '@playwright/test';
import { enqueueResponses, lastAssistant, responses, send } from './helpers';
import type { BrowserDiagnostics, EvidenceRecord } from './shared-web-locale.evidence';
import { runTimelineApprovalScenario } from './shared-web-locale.timeline-approval.scenario';
import {
  captureTimeline,
  expectClipboard,
  type TimelineLabels,
} from './shared-web-locale.timeline.support';

const singlePath = '/动态/timeline/single.ts';
const singleDiff = '+动态-single\n-old-single';
const turnOnePath = '/动态/timeline/turn-one.ts';
const turnTwoPath = '/动态/timeline/turn-two.ts';

export async function runTimelineFileScenarios(
  page: Page,
  labels: TimelineLabels,
  diagnostics: BrowserDiagnostics,
): Promise<EvidenceRecord[]> {
  const records: EvidenceRecord[] = [];
  await enqueueResponses(page, [
    responses.toolCallWithId('file_edit', { path: singlePath, diff: singleDiff }, 'uiimpl024-file-single'),
    responses.text('single timeline file settled'),
  ]);
  await send(page, 'produce one exact timeline file change');
  const pending = lastAssistant(page).getByTestId('timeline-file-outcome');
  await expect(pending).toHaveAttribute('data-file-status', 'running', { timeout: 20_000 });
  const single = lastAssistant(page).getByTestId('timeline-file-outcome');
  await expect(single).toHaveAttribute('data-file-status', 'completed', { timeout: 20_000 });
  await expect(single).toHaveAttribute('data-file-scope', 'file');
  await expect(single).toHaveAttribute('data-source-call-ids', 'uiimpl024-file-single');
  await expect(single).toHaveAttribute('data-timeline-id', 'timeline:file:call:uiimpl024-file-single');
  await expect(single).toContainText(labels.fileSingle);
  await expect(single).toContainText(`${labels.modify} ${singlePath}`);
  await single.getByRole('button', { name: labels.copyPath }).click();
  await expectClipboard(page, singlePath);
  await single.getByRole('button', { name: labels.copyDiff }).click();
  await expectClipboard(page, singleDiff);
  await single.getByRole('button', { name: labels.showDetails }).click();
  await expect(single.getByTestId('file-outcome-details')).toContainText('动态-single');
  const openPath = single.getByRole('button', { name: labels.openPath });
  await expect(openPath).toBeDisabled();
  await expect(openPath).toHaveAttribute('title', labels.pathUnavailableTitle);
  await expect(single.getByRole('status')).toHaveText(labels.pathUnavailable);
  await expect(lastAssistant(page).getByTestId('timeline-tool-uiimpl024-file-single')).toHaveCount(0);
  await expect(lastAssistant(page).getByTestId('tool-card-file_edit')).toHaveCount(0);
  await expect(lastAssistant(page).getByText(labels.legacyOneFile, { exact: true })).toHaveCount(0);
  records.push(await captureTimeline(page, labels, 'timeline-file-single', diagnostics,
    ['single typed file owner preserves id path and diff', 'copy and unavailable host actions verified',
      'legacy file and terminal tool owners absent'], [labels.fileSingle, singlePath]));

  const turnOneDiff = '+动态-turn-one';
  const turnTwoDiff = '+动态-turn-two';
  await enqueueResponses(page, [
    responses.toolCallWithId('file_edit', { path: turnOnePath, diff: turnOneDiff }, 'uiimpl024-file-turn-one'),
    responses.toolCallWithId('file_edit', { path: turnTwoPath, diff: turnTwoDiff }, 'uiimpl024-file-turn-two'),
    responses.text('aggregate timeline files settled'),
  ]);
  await send(page, 'produce ordered aggregate timeline files');
  await expect(lastAssistant(page)).toContainText('aggregate timeline files settled', { timeout: 20_000 });
  const aggregate = lastAssistant(page)
    .locator('[data-testid="timeline-file-outcome"][data-file-scope="turn"]');
  await expect(aggregate).toHaveAttribute('data-file-status', 'completed', { timeout: 20_000 });
  await expect(aggregate).toHaveAttribute('data-file-scope', 'turn');
  await expect(aggregate).toHaveAttribute(
    'data-source-call-ids',
    'uiimpl024-file-turn-one uiimpl024-file-turn-two',
  );
  await expect(aggregate).toHaveAttribute('data-timeline-id', /^timeline:file:turn:/);
  await expect(aggregate).toContainText(labels.fileAggregate);
  await expect(aggregate).toContainText(labels.fileAggregateSummary);
  await expect(aggregate).toContainText(turnOnePath);
  await expect(aggregate).toContainText(turnTwoPath);
  await aggregate.getByRole('button', { name: labels.showDetails }).click();
  await expect(aggregate.getByTestId('file-outcome-details')).toContainText('动态-turn-one');
  await expect(aggregate.getByTestId('file-outcome-details')).toContainText('动态-turn-two');
  await aggregate.getByRole('button', { name: labels.copyDiff }).click();
  await expectClipboard(page, `${turnOneDiff}\n${turnTwoDiff}`);
  await expect(lastAssistant(page).getByTestId('timeline-tool-uiimpl024-file-turn-one')).toHaveCount(0);
  await expect(lastAssistant(page).getByTestId('timeline-tool-uiimpl024-file-turn-two')).toHaveCount(0);
  await expect(lastAssistant(page).getByTestId('tool-card-file_edit')).toHaveCount(0);
  await expect(lastAssistant(page).getByText(labels.legacyTwoFiles, { exact: true })).toHaveCount(0);
  records.push(await captureTimeline(page, labels, 'timeline-file-aggregate', diagnostics,
    ['turn owner preserves ordered source ids and two exact diffs',
      'matching tool and legacy turn-diff owners absent'], [labels.fileAggregate, turnOnePath, turnTwoPath]));

  records.push(await runTimelineApprovalScenario(page, labels, diagnostics));

  await expect(page.locator('html')).toHaveAttribute('lang', labels.html);
  await expect(page.getByTestId('timeline-command-uiimpl024-command-success'))
    .toHaveAttribute('data-timeline-status', 'completed');
  await expect(page.getByTestId('timeline-command-uiimpl024-command-success').getByTestId('command-value'))
    .toHaveText('printf 动态-command');
  await expect(page.getByTestId('timeline-command-uiimpl024-command-success').getByTestId('command-stdout'))
    .toHaveText('stdout-动态-byte');
  await expect(page.getByTestId('timeline-command-uiimpl024-command-fail')).toHaveCount(0);
  await expect(page.getByTestId('timeline-command-uiimpl024-command-retry'))
    .toHaveAttribute('data-timeline-status', 'completed');
  await expect(page.getByTestId('timeline-command-uiimpl024-command-retry').getByTestId('command-stdout'))
    .toHaveText('retry-stdout-动态-byte');
  await expect(page.getByTestId('timeline-tool-uiimpl024-tool-tree').getByTestId('tool-result'))
    .toContainText('/动态/timeline/tree.ts');
  const restoredFiles = page.getByTestId('timeline-file-outcome');
  await expect(restoredFiles).toHaveCount(2);
  await expect(restoredFiles.nth(0)).toHaveAttribute('data-timeline-id', 'timeline:file:call:uiimpl024-file-single');
  await expect(restoredFiles.nth(0)).toHaveAttribute('data-source-call-ids', 'uiimpl024-file-single');
  await expect(restoredFiles.nth(0)).toHaveAttribute('data-file-status', 'completed');
  await expect(restoredFiles.nth(0)).toContainText(singlePath);
  await expect(restoredFiles.nth(1)).toHaveAttribute('data-timeline-id', /^timeline:file:turn:/);
  await expect(restoredFiles.nth(1)).toHaveAttribute(
    'data-source-call-ids', 'uiimpl024-file-turn-one uiimpl024-file-turn-two',
  );
  await expect(restoredFiles.nth(1)).toHaveAttribute('data-file-status', 'completed');
  await expect(restoredFiles.nth(1)).toContainText(turnOnePath);
  await expect(restoredFiles.nth(1)).toContainText(turnTwoPath);
  for (const stale of labels.staleChrome) {
    await expect(page.getByText(stale, { exact: true })).toHaveCount(0);
  }
  records.push(await captureTimeline(page, labels, 'timeline-locale-boundary', diagnostics,
    ['document locale and localized timeline chrome agree',
      'canonical ids source order and payload bytes survive localization'],
    [labels.commandCompleted, labels.toolCompleted, labels.approvalTitle]));
  return records;
}
