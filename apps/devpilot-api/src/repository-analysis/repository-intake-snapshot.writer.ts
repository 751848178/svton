import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, RepositoryAnalysisRun } from '@prisma/client';
import type {
  RepositoryAppliedReference,
  RepositoryApplyInput,
} from './repository-apply.types';
import { repositorySafeJson } from './repository-analysis-storage.utils';

@Injectable()
export class RepositoryIntakeSnapshotWriter {
  create(
    tx: Prisma.TransactionClient,
    run: RepositoryAnalysisRun,
    input: RepositoryApplyInput,
    references: RepositoryAppliedReference[],
    decidedAt: Date,
  ) {
    if (!input.snapshot) throw new Error('snapshot metadata is required');
    const decisions = input.decisions.map((item) => ({
      suggestionId: item.suggestion.id,
      key: item.suggestion.key,
      kind: item.suggestion.kind,
      decision: item.status === 'accepted' ? 'accept'
        : item.status === 'edited' ? 'edit' : 'reject',
      currentValue: item.suggestion.currentValue,
      proposedValue: item.suggestion.proposedValue,
      reviewedValue: item.value || null,
    }));
    const publicReferences = references.map(({ links: _links, ...reference }) => reference);
    const hashPayload = {
      version: input.snapshot.version,
      runId: run.id,
      branch: run.branch,
      commitSha: run.commitSha,
      parserVersion: run.parserVersion,
      actorId: input.userId,
      decidedAt: decidedAt.toISOString(),
      decisions,
      references: publicReferences,
    };
    const snapshotHash = createHash('sha256')
      .update(JSON.stringify(hashPayload))
      .digest('hex');
    return tx.repositoryIntakeReviewSnapshot.create({
      data: {
        teamId: input.teamId,
        projectId: input.projectId,
        runId: run.id,
        actorId: input.userId,
        version: input.snapshot.version,
        inputHash: input.snapshot.inputHash,
        snapshotHash,
        branch: run.branch,
        commitSha: run.commitSha,
        parserVersion: run.parserVersion,
        decisions: repositorySafeJson(decisions),
        references: repositorySafeJson(publicReferences),
        createdAt: decidedAt,
      },
    });
  }
}
