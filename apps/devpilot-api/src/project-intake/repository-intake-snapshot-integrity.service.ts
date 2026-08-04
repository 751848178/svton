import { ConflictException, Injectable } from '@nestjs/common';
import type {
  RepositoryAnalysisSuggestion,
  RepositoryIntakeReviewSnapshot,
} from '@prisma/client';
import { intakeError } from './project-intake-errors.utils';

type ConnectionState = {
  lastAppliedRunId: string | null;
  appliedAt: Date | null;
};

@Injectable()
export class RepositoryIntakeSnapshotIntegrityService {
  assertMatches(
    suggestions: RepositoryAnalysisSuggestion[],
    snapshot: RepositoryIntakeReviewSnapshot,
    connection: ConnectionState,
  ): void {
    const decisions = records(snapshot.decisions);
    const references = new Map(records(snapshot.references).map((item) => [item.suggestionId, item]));
    if (decisions.length !== suggestions.length
      || decisions.some((item) => typeof item.suggestionId !== 'string')) this.fail();
    const byId = new Map(decisions.map((item) => [item.suggestionId, item]));
    for (const suggestion of suggestions) {
      const decision = byId.get(suggestion.id);
      if (!decision || decision.key !== suggestion.key || decision.kind !== suggestion.kind
        || decision.decision !== suggestion.reviewDecision
        || !same(decision.reviewedValue ?? null, suggestion.reviewedValue ?? null)
        || suggestion.reviewedById !== snapshot.actorId
        || !beforeSnapshot(suggestion.reviewedAt, snapshot.createdAt)) this.fail();
      if (decision.decision === 'reject') {
        if (suggestion.status !== 'rejected' || suggestion.appliedAt || suggestion.appliedRefs) this.fail();
        continue;
      }
      const reference = references.get(suggestion.id);
      if (suggestion.status !== 'applied' || !suggestion.appliedAt
        || !beforeSnapshot(suggestion.appliedAt, snapshot.createdAt)
        || !reference || !same(reference, appliedReference(suggestion))) this.fail();
    }
    if (references.size !== suggestions.filter((item) => item.reviewDecision !== 'reject').length
      || connection.lastAppliedRunId !== snapshot.runId
      || !connection.appliedAt
      || !beforeSnapshot(connection.appliedAt, snapshot.createdAt)) this.fail();
  }

  private fail(): never {
    throw new ConflictException(intakeError(
      'PROJECT_INTAKE_REVIEW_SNAPSHOT_DRIFT',
      '已应用的仓库确认状态与不可变快照不一致',
      '请重新分析当前仓库并形成新的确认快照。',
    ));
  }
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function appliedReference(suggestion: RepositoryAnalysisSuggestion) {
  const value = suggestion.appliedRefs;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { links: _links, ...reference } = value as Record<string, unknown>;
  return { ...reference, suggestionId: suggestion.id };
}

function beforeSnapshot(value: Date | null, createdAt: Date): boolean {
  return !!value && value.getTime() <= createdAt.getTime();
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
