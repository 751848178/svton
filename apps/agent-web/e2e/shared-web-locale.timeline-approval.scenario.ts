import { expect, type Locator, type Page } from '@playwright/test';
import { enqueueResponses, lastAssistant, responses, send } from './helpers';
import type { BrowserDiagnostics, EvidenceRecord } from './shared-web-locale.evidence';
import { captureTimeline, type TimelineLabels } from './shared-web-locale.timeline.support';

interface PendingApproval {
  dialog: Locator;
  history: Locator;
}

export async function runTimelineApprovalScenario(
  page: Page,
  labels: TimelineLabels,
  diagnostics: BrowserDiagnostics,
): Promise<EvidenceRecord> {
  const accepted = await openApproval(page, labels, 'accept', 'uiimpl024-approval', true);
  await accepted.dialog.getByRole('button', { name: labels.allowOnce }).click();
  await expect(accepted.history).toHaveAttribute('data-status', 'completed', { timeout: 20_000 });
  await expect(accepted.history).toContainText(labels.approvalAllowed);
  await expect(lastAssistant(page)).toContainText('accept timeline settled');

  const declined = await openApproval(page, labels, 'decline', 'uiimpl024-approval-decline', true);
  await declined.dialog.getByRole('button', { name: labels.decline }).click();
  await expect(declined.history).toHaveAttribute('data-status', 'declined', { timeout: 20_000 });
  await expect(declined.history).toContainText(labels.approvalDeclined);
  await expect(lastAssistant(page)).toContainText('decline timeline settled');

  const cancelled = await openApproval(page, labels, 'cancel', 'uiimpl024-approval-cancel', true);
  await cancelled.dialog.getByRole('button', { name: labels.cancel }).click();
  await expect(cancelled.history).toHaveAttribute('data-status', 'cancelled', { timeout: 20_000 });
  await expect(cancelled.history).toContainText(labels.approvalCancelled);
  await expect(lastAssistant(page)).toContainText('cancel timeline settled');

  await openApproval(page, labels, 'interrupt', 'uiimpl024-approval-interrupt', false);
  await expect(page.getByTestId('approval-decision-history')).toHaveCount(4);
  await page.reload();
  await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
  const histories = page.getByTestId('approval-decision-history');
  await expect(histories).toHaveCount(4, { timeout: 20_000 });
  await expect(histories.nth(0)).toHaveAttribute('data-status', 'completed');
  await expect(histories.nth(1)).toHaveAttribute('data-status', 'declined');
  await expect(histories.nth(2)).toHaveAttribute('data-status', 'cancelled');
  await expect(histories.nth(3)).toHaveAttribute('data-status', 'interrupted');
  await expect(histories.nth(3)).toContainText(labels.approvalInterrupted);
  await expect(page.getByTestId('tool-card-e2e_approval')).toHaveCount(0);
  await expect(page.getByTestId('chat-status-announcer')).toHaveCount(1);
  await expect(page.getByTestId('message-assistant').getByRole('alert')).toHaveCount(0);
  return captureTimeline(page, labels, 'timeline-approval', diagnostics,
    ['waiting approvals settled as accept decline cancel and reload interruption',
      'four histories restored without duplicate legacy owners'],
    [labels.approvalTitle, labels.approvalAllowed, labels.approvalInterrupted]);
}

async function openApproval(
  page: Page,
  labels: TimelineLabels,
  action: string,
  callId: string,
  completion: boolean,
): Promise<PendingApproval> {
  const queued = [
    responses.toolCallWithId('e2e_approval', {
      command: `${action}-动态-reason`, stdout: `${action}-动态-output`,
    }, callId),
  ];
  if (completion) queued.push(responses.text(`${action} timeline settled`));
  await enqueueResponses(page, queued);
  await send(page, `${action} exact timeline approval`);
  const dialog = page.getByRole('alertdialog', { name: labels.approvalDialog });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const history = page.getByTestId('approval-decision-history').last();
  await expect(history).toHaveAttribute('data-status', 'awaitingApproval');
  await expect(history).toContainText(labels.approvalTitle);
  await expect(history).toContainText(labels.approvalPending);
  await expect(history).toContainText('Requires approval: e2e_approval');
  return { dialog, history };
}
