import React, { useCallback, useRef } from 'react';
import { Modal, useI18n, type TranslationKey } from '@svton/ui';
import { getToolDisplayName } from './tool-names';
import type { ApprovalDecisionView, ApprovalRequestView } from './approval.types';

export interface ToolApprovalModalProps {
  request: ApprovalRequestView;
  onDecision: (requestId: string, decision: ApprovalDecisionView) => void;
}

const DECISION_VIEW: Record<ApprovalDecisionView, { label: TranslationKey; testId: string; className: string }> = {
  cancel: { label: 'approval.cancel', testId: 'tool-cancel', className: 'border border-border text-gray-300 hover:bg-muted' },
  decline: { label: 'approval.decline', testId: 'tool-reject', className: 'border border-border text-gray-300 hover:bg-muted' },
  acceptForSession: { label: 'approval.allowSession', testId: 'tool-approve-session', className: 'border border-cyan-800 text-cyan-200 hover:bg-cyan-950/40' },
  accept: { label: 'approval.allowOnce', testId: 'tool-approve', className: 'bg-primary text-primary-foreground hover:bg-primary/90' },
};
const DECISION_ORDER: ApprovalDecisionView[] = ['cancel', 'decline', 'acceptForSession', 'accept'];

function formatArguments(args: Record<string, unknown>, unavailable: string) {
  return Object.entries(args).map(([key, value]) => {
    const text = formatArgumentValue(value, unavailable);
    return { key, value: text.length > 200 ? `${text.slice(0, 200)}…` : text };
  });
}

function formatArgumentValue(value: unknown, unavailable: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  try {
    const serialized = JSON.stringify(value, null, 2);
    return typeof serialized === 'string' ? serialized : String(value ?? 'null');
  } catch {
    return unavailable;
  }
}

/** Session-owned global alertdialog; persisted history remains non-actionable. */
export function ToolApprovalModal({ request, onDecision }: ToolApprovalModalProps) {
  const { translate } = useI18n();
  const requestKey = `${request.sessionId}:${request.requestId}`;
  const decisionState = useRef({ requestKey, settled: false });
  if (decisionState.current.requestKey !== requestKey) {
    decisionState.current = { requestKey, settled: false };
  }
  const decide = useCallback((decision: ApprovalDecisionView) => {
    if (decisionState.current.settled || !request.decisions.includes(decision)) return;
    decisionState.current.settled = true;
    onDecision(request.requestId, decision);
  }, [onDecision, request]);
  const canCancel = request.decisions.includes('cancel');
  const safeDecision = canCancel ? 'cancel' : request.decisions.includes('decline') ? 'decline' : null;
  const displayName = getToolDisplayName(request.toolName, translate);
  const description = (
    <span data-approval-summary tabIndex={-1}>{translate('approval.summary', { tool: displayName })}{request.reason ? ` ${request.reason}` : ''}</span>
  );
  const footer = DECISION_ORDER.filter((decision) => request.decisions.includes(decision)).map((decision) => {
    const view = DECISION_VIEW[decision];
    return (
      <button
        key={decision}
        type="button"
        data-approval-decision={decision}
        data-testid={view.testId}
        onClick={() => decide(decision)}
        className={`rounded-lg px-4 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring ${view.className}`}
      >
        {translate(view.label)}
      </button>
    );
  });
  return (
    <Modal
      open
      onClose={() => decide('cancel')}
      role="alertdialog"
      title={translate('approval.title')}
      description={description}
      maskClosable={false}
      closeOnEscape={canCancel}
      showCloseButton={false}
      initialFocusSelector={safeDecision ? `[data-approval-decision="${safeDecision}"]` : '[data-approval-summary]'}
      restoreFocusSelector={'[data-testid="chat-input"]'}
      testId="tool-approval-dialog"
      width={512}
      className="max-h-[85vh] border border-border bg-popover shadow-2xl"
      bodyClassName="p-0"
      footerClassName="flex-wrap bg-[#171717]"
      footer={footer}
    >
      {Object.keys(request.arguments).length > 0 && (
        <section className="px-5 py-4" aria-label={translate('approval.parameters')}>
          <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">{translate('approval.parameters')}</h3>
          <dl className="space-y-2">
            {formatArguments(request.arguments, translate('approval.unavailable')).map(({ key, value }) => (
              <div key={key} className="grid grid-cols-[minmax(72px,auto)_1fr] gap-3">
                <dt className="break-all text-xs font-medium text-muted-foreground">{key}</dt>
                <dd className="break-all whitespace-pre-wrap text-xs text-gray-300">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </Modal>
  );
}
