import {
  redactSecrets,
  type ToolApprovalDecision,
  type ToolApprovalSettlementDecision,
} from '@svton/agent-core';
import { boundTimelineText } from './bounds';
import type { ApprovalDecisionTimelineItem, TimelineItemBase } from './types';
import { sanitizeApprovalArguments, sanitizeApprovalMetadata } from './approval-public-record';

const DECISIONS: ToolApprovalDecision[] = [
  'accept', 'acceptForSession', 'decline', 'cancel',
];
const SETTLEMENTS: ToolApprovalSettlementDecision[] = [
  ...DECISIONS, 'interrupted',
];

/** Defensive persisted-boundary parser for secret-safe approval history. */
export function parseApprovalDecision(
  value: Record<string, unknown>,
  common: TimelineItemBase,
): ApprovalDecisionTimelineItem | null {
  if (!isId(value.requestId) || !isId(value.itemId) || !isId(value.toolName)) return null;
  if (!isRecord(value.arguments) || !validDecisions(value.decisions)) return null;
  if (!optionalString(value.reason) || !optionalRecord(value.metadata)) return null;
  if (!optionalSettlement(value.decision)) return null;
  const decision = value.decision as ToolApprovalSettlementDecision | undefined;
  if (!validApprovalState(common, decision)) return null;
  return {
    ...common,
    kind: 'approvalDecision',
    requestId: value.requestId,
    itemId: value.itemId,
    toolName: boundTimelineText(value.toolName, 512),
    arguments: sanitizeApprovalArguments(value.arguments),
    decisions: value.decisions,
    ...(typeof value.reason === 'string'
      ? { reason: boundTimelineText(redactSecrets(value.reason)) }
      : {}),
    ...(isRecord(value.metadata)
      ? { metadata: sanitizeApprovalMetadata(value.metadata) }
      : {}),
    ...(decision ? { decision } : {}),
  };
}

function validDecisions(value: unknown): value is ToolApprovalDecision[] {
  return Array.isArray(value) && value.length > 0
    && value.every((decision) => DECISIONS.includes(decision as ToolApprovalDecision));
}

function optionalSettlement(value: unknown): boolean {
  return value === undefined
    || SETTLEMENTS.includes(value as ToolApprovalSettlementDecision);
}

function validApprovalState(
  common: TimelineItemBase,
  decision: ToolApprovalSettlementDecision | undefined,
): boolean {
  if (common.lane === 'decision') {
    return common.status === 'awaitingApproval' && decision === undefined;
  }
  if (common.lane !== 'outcome') return false;
  if (common.status === 'completed') {
    return decision === 'accept' || decision === 'acceptForSession';
  }
  if (common.status === 'declined') return decision === 'decline';
  if (common.status === 'cancelled') return decision === 'cancel';
  return common.status === 'interrupted' && decision === 'interrupted';
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function optionalRecord(value: unknown): boolean {
  return value === undefined || isRecord(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
