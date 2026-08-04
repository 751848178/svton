import { PrismaClient } from '@prisma/client';
import { mkdtemp, realpath, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProjectIntakeService } from './project-intake.service';
import {
  createIntakeService,
  createRepository,
  repositoryFingerprint,
} from './repository-intake-real-git.fixture';
const describeIntegration = process.env.RUN_PROJECT_INTAKE_INTEGRATION === '1'
  ? describe : describe.skip;

describeIntegration('real git repository intake integration', () => {
  const prisma = new PrismaClient();
  let root: string;
  let intake: ProjectIntakeService;

  beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'f415-real-git-')));
    await createRepository(root);
    intake = createIntakeService(prisma, root);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  it('pins a real branch and commit, parses components read-only, reviews and finalizes', async () => {
    const suffix = root.split('-').at(-1)!;
    const actorId = `git-actor-${suffix}`;
    const teamId = `git-team-${suffix}`;
    await prisma.user.create({ data: { id: actorId, email: `${suffix}@git.example`, role: 'user' } });
    await prisma.team.create({ data: { id: teamId, name: `Git ${suffix}` } });
    const draft = await intake.createDraft(teamId, actorId, { name: 'Real monorepo' });
    const before = await repositoryFingerprint(root);
    const connection = await intake.connect(teamId, actorId, draft.id, {
      repositoryUrl: root,
      branch: 'main',
      visibility: 'private',
      credential: {
        type: 'https_token', name: 'managed-readonly', username: 'git',
        secret: 'F415_PRIVATE_SENTINEL_NEVER_RENDER',
      },
    });
    expect(connection).toMatchObject({
      defaultBranch: 'main', selectedBranch: 'main', commitSha: before.commit,
      credentialSource: 'team_credential', status: 'connected',
    });
    expect(JSON.stringify(connection)).not.toContain('F415_PRIVATE_SENTINEL');
    const run = await intake.startAnalysis(teamId, actorId, draft.id, {
      branch: 'main', idempotencyKey: `real-git-${suffix}`,
    });
    const succeeded = await waitForRun(run.id);
    expect(succeeded).toMatchObject({ status: 'succeeded', branch: 'main', commitSha: before.commit });
    const contract = await intake.contract(teamId, draft.id, run.id);
    expect(contract.repository).toMatchObject({
      defaultBranch: 'main', selectedBranch: 'main', commitSha: before.commit,
      managedReference: { source: 'team_credential' },
    });
    expect(contract.overview?.value).toMatchObject({
      architecture: 'monorepo', packageManager: 'pnpm', deploymentPlan: 'container',
    });
    expect(contract.components.map((item) => item.value)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'apps/api', type: 'backend_service', buildOutput: 'oci_image' }),
      expect.objectContaining({ path: 'apps/web', type: 'frontend_site' }),
      expect.objectContaining({ path: 'apps/worker', type: 'worker' }),
    ]));
    const reviewed = await intake.review(teamId, actorId, draft.id, run.id, {
      items: [
        ...(contract.overview ? [{ suggestionId: contract.overview.suggestionId, decision: 'accept' as const }] : []),
        ...contract.components.map((item) => ({ suggestionId: item.suggestionId, decision: 'accept' as const })),
        ...contract.dependencies.map((item) => ({ suggestionId: item.suggestionId, decision: item.kind === 'resource_requirement' ? 'reject' as const : 'accept' as const })),
      ],
    });
    expect(reviewed.snapshot).toMatchObject({ branch: 'main', commitSha: before.commit, version: 1 });
    const finalized = await intake.finalize(teamId, actorId, draft.id, {
      analysisRunId: run.id,
      reviewSnapshotId: reviewed.snapshot!.id,
      reviewSnapshotHash: reviewed.snapshot!.hash,
      idempotencyKey: `finalize-${suffix}`,
    });
    expect(finalized).toMatchObject({
      projectId: draft.id, reviewSnapshotId: reviewed.snapshot!.id,
      reviewSnapshotHash: reviewed.snapshot!.hash,
    });
    expect(await repositoryFingerprint(root)).toEqual(before);
    const evidence = await prisma.auditEvent.findMany({ where: { projectId: draft.id } });
    const credential = await prisma.teamCredential.findFirstOrThrow({ where: { teamId } });
    expect(JSON.stringify({ evidence, credential })).not.toContain('F415_PRIVATE_SENTINEL');
    console.log(JSON.stringify({
      projectId: draft.id, runId: run.id, snapshotId: reviewed.snapshot!.id,
      branch: connection.selectedBranch, commit: connection.commitSha,
      componentPaths: contract.components.map((item) => item.value.path),
      repositoryUnchanged: true, managedReferenceOnly: true,
    }));
  });

  async function waitForRun(runId: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const run = await prisma.repositoryAnalysisRun.findUniqueOrThrow({ where: { id: runId } });
      if (!['queued', 'running'].includes(run.status)) return run;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('real repository analysis timed out');
  }
});
