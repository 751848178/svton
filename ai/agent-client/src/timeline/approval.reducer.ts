import type {
  TimelineAction,
  TimelineItem,
  TimelineStatus,
  TimelineTurn,
} from './types';

type SettleApprovalAction = Extract<TimelineAction, { type: 'settleApproval' }>;

/** Resolve an approval item without conflating user choices with execution failure. */
export function settleApproval(
  state: TimelineTurn,
  action: SettleApprovalAction,
): TimelineTurn {
  if (state.status !== 'running') return state;
  const target = state.items.find((item) =>
    item.kind === 'approvalDecision' && item.requestId === action.requestId);
  if (!target || isApprovalTerminal(target.status)) return state;
  const items = state.items.map((item): TimelineItem => {
    if (item.kind !== 'approvalDecision' || item.requestId !== action.requestId) return item;
    return {
      ...item,
      lane: 'outcome',
      status: approvalStatus(action.decision),
      title: approvalTitle(action.decision, item.toolName),
      decision: action.decision,
      completedAt: action.at,
      revision: item.revision + 1,
    };
  });
  return { ...state, items, revision: state.revision + 1 };
}

function approvalStatus(decision: SettleApprovalAction['decision']): TimelineStatus {
  if (decision === 'decline') return 'declined';
  if (decision === 'cancel') return 'cancelled';
  if (decision === 'interrupted') return 'interrupted';
  return 'completed';
}

function approvalTitle(decision: SettleApprovalAction['decision'], toolName: string): string {
  if (decision === 'decline') return `Declined ${toolName}`;
  if (decision === 'cancel') return `Cancelled ${toolName}`;
  if (decision === 'interrupted') return `${toolName} approval interrupted`;
  return decision === 'acceptForSession'
    ? `Approved ${toolName} for this session`
    : `Approved ${toolName}`;
}

function isApprovalTerminal(status: TimelineStatus): boolean {
  return !['pending', 'running', 'awaitingApproval'].includes(status);
}
