import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RepositoryApplicationApplyRepository } from '../repository-analysis/repository-application-apply.repository';
import { RepositoryIntakeSnapshotWriter } from '../repository-analysis/repository-intake-snapshot.writer';
import { RepositoryPlatformApplyRepository } from '../repository-analysis/repository-platform-apply.repository';
import { RepositorySuggestionApplyRepository } from '../repository-analysis/repository-suggestion-apply.repository';
import { RepositorySuggestionApplyService } from '../repository-analysis/repository-suggestion-apply.service';
import { RepositoryIntakeContractRepository } from './repository-intake-contract.repository';
import { RepositoryIntakeContractService } from './repository-intake-contract.service';
import {
  waitForRepositoryIntakeLockWaiters,
  waitForRepositoryRunLockWaiters,
} from './repository-intake-lock-wait.fixture';
import { RepositoryIntakeReviewService } from './repository-intake-review.service';

const describeIntegration = process.env.RUN_PROJECT_INTAKE_INTEGRATION === '1'
  ? describe : describe.skip;

describeIntegration('repository intake immutable review integration', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const teamId = `team-review-${suffix}`;
  const actorId = `actor-review-${suffix}`;
  const projectId = `project-review-${suffix}`;
  const runId = `run-review-${suffix}`;
  const raceProjectId = `project-review-race-${suffix}`;
  const raceRunId = `run-review-race-${suffix}`;
  let service: RepositoryIntakeReviewService;
  let apply: RepositorySuggestionApplyService;

  beforeAll(async () => {
    const db = prisma as unknown as PrismaService;
    const platform = new RepositoryPlatformApplyRepository(
      new RepositoryApplicationApplyRepository(),
    );
    apply = new RepositorySuggestionApplyService(
      new RepositorySuggestionApplyRepository(
        db,
        platform,
        new RepositoryIntakeSnapshotWriter(),
      ),
    );
    const repository = new RepositoryIntakeContractRepository(db);
    const contracts = new RepositoryIntakeContractService(repository);
    service = new RepositoryIntakeReviewService(repository, contracts, apply);
    await seed();
  });

  it('serializes a queued generic apply behind snapshot creation without later mutation', async () => {
    let unlock!: () => void;
    let ready!: () => void;
    const release = new Promise<void>((resolve) => { unlock = resolve; });
    const locked = new Promise<void>((resolve) => { ready = resolve; });
    const blocker = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM RepositoryAnalysisRun WHERE id = ${raceRunId} FOR UPDATE`;
      ready();
      await release;
    });
    await locked;
    const reviewPromise = service.review(
      teamId, actorId, raceProjectId, raceRunId, review('reject', raceRunId),
    );
    await waitForRepositoryRunLockWaiters(prisma, 1);
    const genericPromise = apply.apply(
      teamId, actorId, raceProjectId, raceRunId, genericReview('accept', raceRunId),
    );
    await waitForRepositoryIntakeLockWaiters(prisma, 2);
    unlock();
    await blocker;
    const [reviewResult, genericResult] = await Promise.allSettled([
      reviewPromise, genericPromise,
    ]);
    expect(reviewResult.status).toBe('fulfilled');
    expect(genericResult).toMatchObject({
      status: 'rejected', reason: { response: { code: 'REPOSITORY_INTAKE_REVIEW_IMMUTABLE' } },
    });
    const snapshot = await prisma.repositoryIntakeReviewSnapshot.findUniqueOrThrow({
      where: { runId: raceRunId },
    });
    const state = await prisma.repositoryAnalysisSuggestion.findMany({
      where: { runId: raceRunId }, orderBy: { id: 'asc' },
    });
    const decisionById = new Map((snapshot.decisions as Array<{
      suggestionId: string; decision: string; reviewedValue: unknown;
    }>).map((item) => [item.suggestionId, item]));
    for (const suggestion of state) {
      const decision = decisionById.get(suggestion.id)!;
      expect(suggestion.reviewDecision).toBe(decision.decision);
      expect(suggestion.reviewedValue).toEqual(decision.reviewedValue);
      expect(suggestion.reviewedAt!.getTime()).toBeLessThanOrEqual(snapshot.createdAt.getTime());
    }
    expect(await prisma.auditEvent.count({
      where: { projectId: raceProjectId, action: 'repository.suggestions.apply' },
    })).toBe(1);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: raceProjectId } });
    expect(JSON.stringify(project.config)).not.toContain('resourceRequirements');
  });
  afterAll(() => prisma.$disconnect());

  it('commits one immutable winner and replays only the same normalized input', async () => {
    const accept = review('accept');
    const reject = review('reject');
    const results = await Promise.allSettled([
      service.review(teamId, actorId, projectId, runId, accept),
      service.review(teamId, actorId, projectId, runId, reject),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const snapshots = await prisma.repositoryIntakeReviewSnapshot.findMany({
      where: { runId },
    });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      teamId, projectId, runId, actorId, version: 1,
      branch: 'main', commitSha: 'a'.repeat(40), parserVersion: 'integration-v1',
    });
    expect(snapshots[0].snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    const decisions = snapshots[0].decisions as Array<{ suggestionId: string; decision: string }>;
    const resourceDecision = decisions.find((item) => item.suggestionId === `${runId}-resource`)!;
    const winner = resourceDecision.decision === 'reject' ? reject : accept;
    await expect(service.review(teamId, actorId, projectId, runId, winner))
      .resolves.toMatchObject({ snapshot: { id: snapshots[0].id } });
    await expect(service.review(
      teamId, actorId, projectId, runId,
      resourceDecision.decision === 'reject' ? accept : reject,
    )).rejects.toMatchObject({ response: { code: 'REPOSITORY_INTAKE_REVIEW_IMMUTABLE' } });
    expect(await prisma.auditEvent.count({
      where: { projectId, action: 'repository.suggestions.apply' },
    })).toBe(1);
  });

  async function seed() {
    await prisma.user.create({ data: { id: actorId, email: `${suffix}@example.com`, role: 'user' } });
    await prisma.team.create({ data: { id: teamId, name: `Review ${suffix}` } });
    await seedProject(projectId, runId, 'Review race');
    await seedProject(raceProjectId, raceRunId, 'Review queued race');
  }

  async function seedProject(targetProjectId: string, targetRunId: string, name: string) {
    await prisma.project.create({ data: {
      id: targetProjectId, teamId, createdById: actorId, name, config: {},
      onboardingStatus: 'draft', onboardingRevision: 1,
    } });
    const connection = await prisma.repositoryConnection.create({ data: {
      teamId, projectId: targetProjectId, connectedById: actorId,
      repositoryUrl: `https://git.example/${targetProjectId}.git`,
      provider: 'generic', visibility: 'private', credentialSource: 'team_credential',
      defaultBranch: 'main', selectedBranch: 'main', commitSha: 'a'.repeat(40), status: 'connected',
    } });
    await prisma.repositoryAnalysisRun.create({ data: {
      id: targetRunId, teamId, projectId: targetProjectId,
      connectionId: connection.id, triggeredById: actorId,
      repositoryUrl: connection.repositoryUrl, branch: 'main', commitSha: 'a'.repeat(40),
      status: 'succeeded', idempotencyKey: `review-${targetRunId}`, parserVersion: 'integration-v1',
      suggestions: { create: [
        {
          id: `${targetRunId}-repo`, key: 'project_repository', kind: 'project_repository',
          proposedValue: {
            gitRepo: connection.repositoryUrl,
            source: { branch: 'main', commitSha: 'a'.repeat(40), verified: true },
            intakeContract: { version: 1, overview: {
              projectType: 'backend_service', architecture: 'single_repository',
              packageManager: 'pnpm', deploymentPlan: 'process',
            } },
          },
        },
        {
          id: `${targetRunId}-resource`, key: 'resource_requirements', kind: 'resource_requirement',
          proposedValue: { requirements: ['mysql'] },
        },
      ] },
    } });
  }

  function review(resource: 'accept' | 'reject', targetRunId = runId) {
    return { items: [
      { suggestionId: `${targetRunId}-repo`, decision: 'accept' as const },
      { suggestionId: `${targetRunId}-resource`, decision: resource },
    ] };
  }

  function genericReview(resource: 'accept' | 'reject', targetRunId: string) {
    return { decisions: [
      { suggestionId: `${targetRunId}-repo`, decision: 'accept' as const },
      { suggestionId: `${targetRunId}-resource`, decision: resource },
    ] };
  }

});
