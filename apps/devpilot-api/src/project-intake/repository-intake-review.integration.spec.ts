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
  let service: RepositoryIntakeReviewService;

  beforeAll(async () => {
    const db = prisma as unknown as PrismaService;
    const platform = new RepositoryPlatformApplyRepository(
      new RepositoryApplicationApplyRepository(),
    );
    const apply = new RepositorySuggestionApplyService(
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
    await prisma.project.create({ data: {
      id: projectId, teamId, createdById: actorId, name: 'Review race', config: {},
      onboardingStatus: 'draft', onboardingRevision: 1,
    } });
    const connection = await prisma.repositoryConnection.create({ data: {
      teamId, projectId, connectedById: actorId, repositoryUrl: 'https://git.example/review.git',
      provider: 'generic', visibility: 'private', credentialSource: 'team_credential',
      defaultBranch: 'main', selectedBranch: 'main', commitSha: 'a'.repeat(40), status: 'connected',
    } });
    await prisma.repositoryAnalysisRun.create({ data: {
      id: runId, teamId, projectId, connectionId: connection.id, triggeredById: actorId,
      repositoryUrl: connection.repositoryUrl, branch: 'main', commitSha: 'a'.repeat(40),
      status: 'succeeded', idempotencyKey: `review-${suffix}`, parserVersion: 'integration-v1',
      suggestions: { create: [
        {
          id: `${runId}-repo`, key: 'project_repository', kind: 'project_repository',
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
          id: `${runId}-resource`, key: 'resource_requirements', kind: 'resource_requirement',
          proposedValue: { requirements: ['mysql'] },
        },
      ] },
    } });
  }

  function review(resource: 'accept' | 'reject') {
    return { items: [
      { suggestionId: `${runId}-repo`, decision: 'accept' as const },
      { suggestionId: `${runId}-resource`, decision: resource },
    ] };
  }
});
