import { ConflictException } from '@nestjs/common';
import type { RepositoryAnalysisSuggestion, RepositoryIntakeReviewSnapshot } from '@prisma/client';
import { RepositoryIntakeSnapshotIntegrityService } from './repository-intake-snapshot-integrity.service';

const decidedAt = new Date('2026-08-04T00:01:00.000Z');
const appliedAt = new Date('2026-08-04T00:00:00.000Z');

describe('RepositoryIntakeSnapshotIntegrityService', () => {
  const service = new RepositoryIntakeSnapshotIntegrityService();

  it('accepts the frozen applied state and rejects suggestion drift', () => {
    const suggestion = state();
    expect(() => service.assertMatches(
      [suggestion], snapshot(), { lastAppliedRunId: 'run-1', appliedAt },
    )).not.toThrow();

    expect(() => service.assertMatches(
      [{ ...suggestion, reviewedValue: { value: 'drift' } }],
      snapshot(),
      { lastAppliedRunId: 'run-1', appliedAt },
    )).toThrow(ConflictException);
  });

  it('rejects post-snapshot connection or review timestamps', () => {
    const after = new Date('2026-08-04T00:02:00.000Z');
    expect(() => service.assertMatches(
      [{ ...state(), reviewedAt: after }], snapshot(),
      { lastAppliedRunId: 'run-1', appliedAt },
    )).toThrow(ConflictException);
    expect(() => service.assertMatches(
      [state()], snapshot(), { lastAppliedRunId: 'run-1', appliedAt: after },
    )).toThrow(ConflictException);
  });
});

function state(): RepositoryAnalysisSuggestion {
  return {
    id: 'suggestion-1', runId: 'run-1', reviewedById: 'actor-1', key: 'project_repository',
    kind: 'project_repository', status: 'applied', reviewDecision: 'accept',
    reviewedValue: { value: 'frozen' }, reviewedAt: appliedAt, appliedAt,
    appliedRefs: { suggestionId: '', kind: 'project_repository', projectId: 'project-1', links: [] },
  } as unknown as RepositoryAnalysisSuggestion;
}

function snapshot(): RepositoryIntakeReviewSnapshot {
  return {
    id: 'snapshot-1', teamId: 'team-1', projectId: 'project-1', runId: 'run-1',
    actorId: 'actor-1', version: 1, inputHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64),
    branch: 'main', commitSha: 'c'.repeat(40), parserVersion: 'v1', createdAt: decidedAt,
    decisions: [{ suggestionId: 'suggestion-1', key: 'project_repository',
      kind: 'project_repository', decision: 'accept', reviewedValue: { value: 'frozen' } }],
    references: [{ suggestionId: 'suggestion-1', kind: 'project_repository', projectId: 'project-1' }],
  } as RepositoryIntakeReviewSnapshot;
}
