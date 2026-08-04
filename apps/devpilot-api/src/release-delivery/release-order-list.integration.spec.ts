import "reflect-metadata";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseOrderListRepository } from "./release-order-list.repository";
import { ReleaseOrderListService } from "./release-order-list.service";
import type { ReleaseOrderListStatus } from "./release-order-list.types";

const describeIntegration =
  process.env.RUN_RELEASE_ORDER_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("release order list real MySQL integration", () => {
  const prisma = new PrismaClient();
  const service = new ReleaseOrderListService(
    new ReleaseOrderListRepository(prisma as unknown as PrismaService),
  );
  const keepBrowserFixture = process.env.KEEP_F419_BROWSER_FIXTURE === "1";
  const suffix = process.env.F419_FIXTURE_SUFFIX || randomUUID();
  const actorId = `f419-user-${suffix}`;
  const teamId = `f419-team-${suffix}`;
  const otherTeamId = `f419-other-team-${suffix}`;
  const projectId = `f419-project-${suffix}`;
  const otherProjectId = `f419-other-project-${suffix}`;
  const stagingId = `f419-staging-${suffix}`;
  const productionId = `f419-production-${suffix}`;
  const richOrderId = `f419-rich-order-${suffix}`;
  const draftOrderId = `f419-draft-order-${suffix}`;
  const rebuildOrderId = `f419-rebuild-order-${suffix}`;
  const specialOrderId = `f419-special-order-${suffix}`;
  const tieOrderId = `f419-tie-order-${suffix}`;
  const buildOneId = `f419-build-one-${suffix}`;
  const buildTwoId = `f419-build-two-${suffix}`;
  const buildThreeId = `f419-build-three-${suffix}`;
  const manifestOneId = `f419-manifest-one-${suffix}`;
  const manifestTwoId = `f419-manifest-two-${suffix}`;
  const digestTwo = `sha256:${"b".repeat(64)}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: actorId,
        email: `${suffix}@f419.example`,
        passwordHash: keepBrowserFixture
          ? await bcrypt.hash(process.env.F419_BROWSER_PASSWORD || "", 10)
          : null,
        role: keepBrowserFixture ? "admin" : "user",
      },
    });
    await prisma.team.createMany({
      data: [
        { id: teamId, name: "F419 Team" },
        { id: otherTeamId, name: "F419 Other Team" },
      ],
    });
    await seedProjects();
    await prisma.teamMember.createMany({
      data: [
        { teamId, userId: actorId, role: "owner" },
        { teamId: otherTeamId, userId: actorId, role: "owner" },
      ],
    });
    await seedOrders();
    await seedRichExecutions();
    await seedRebuildExecutions();
    await seedTieExecutions();
    if (keepBrowserFixture) await seedBrowserFillers();
  });

  afterAll(async () => {
    if (keepBrowserFixture) {
      console.log(
        "F419_BROWSER_FIXTURE",
        JSON.stringify({
          actorId,
          email: `${suffix}@f419.example`,
          teamId,
          otherTeamId,
          projectId,
          otherProjectId,
          richOrderId,
          draftOrderId,
          rebuildOrderId,
          specialOrderId,
          tieOrderId,
          buildThreeId,
          manifestTwoId,
          digestTwo,
        }),
      );
      await prisma.$disconnect();
      return;
    }
    await prisma.releaseRun.deleteMany({ where: { projectId } });
    await prisma.deploymentRun.deleteMany({ where: { projectId } });
    await prisma.artifactManifest.deleteMany({ where: { projectId } });
    await prisma.buildRun.deleteMany({ where: { projectId } });
    await prisma.releaseOrder.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    });
    await prisma.projectEnvironment.deleteMany({ where: { projectId } });
    await prisma.projectRepositoryIdentity.updateMany({
      where: { projectId },
      data: { currentRevisionId: null },
    });
    await prisma.projectRepositoryIdentityRevision.deleteMany({
      where: { projectId },
    });
    await prisma.projectRepositoryIdentity.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({
      where: { id: { in: [projectId, otherProjectId] } },
    });
    await prisma.team.deleteMany({
      where: { id: { in: [teamId, otherTeamId] } },
    });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("searches version, Commit, Build id/revision, Manifest id/digest and note", async () => {
    for (const query of [
      "2.4.1",
      "c".repeat(8),
      buildThreeId.slice(0, 28),
      "Build #3",
      manifestTwoId.slice(0, 32),
      digestTwo.slice(0, 24),
      "failed build keeps prior manifest",
    ]) {
      const result = await list({ query });
      expect(result.items.map((item) => item.id)).toContain(richOrderId);
    }
  });

  it.each(["%", "_", "\\", "="])(
    "treats %s as a literal LIKE character",
    async (query) => {
      const result = await list({ query });
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe(specialOrderId);
    },
  );

  it("keeps apostrophe and Unicode searches parameterized and scoped", async () => {
    for (const query of ["O'Reilly", "发布说明"]) {
      const result = await list({ query });
      expect(result.items.map((item) => item.id)).toEqual([specialOrderId]);
    }
    const otherScope = await service.list(
      otherTeamId,
      actorId,
      otherProjectId,
      {
        query: "2.4.1",
        take: 50,
      },
    );
    expect(otherScope.items).toHaveLength(1);
    expect(otherScope.items[0].projectId).toBe(otherProjectId);
    expect((await list({ query: "other-team-secret" })).total).toBe(0);
  });

  it("filters only the persisted five-state contract and preserves total before take", async () => {
    const active = await list({ status: "active", take: 1 });
    expect(active.total).toBe(3);
    expect(active.items).toHaveLength(1);
    expect(active.items[0].status).toBe("active");
    expect(
      (await list({ status: "draft" })).items.every(
        (item) => item.status === "draft",
      ),
    ).toBe(true);
  });

  it("sorts by true execution time and projects failed latest Build with prior Manifest", async () => {
    const result = await list({ take: 50 });
    const rich = result.items.find((item) => item.id === richOrderId)!;
    expect(result.items[0].id).toBe(tieOrderId);
    expect(result.items.indexOf(rich)).toBeLessThan(
      result.items.findIndex((item) => item.id === draftOrderId),
    );
    expect(rich.source).toMatchObject({
      branch: "main",
      commitSha: "c".repeat(40),
      buildRunId: buildThreeId,
      buildRevision: 3,
      buildStatus: "failed",
    });
    expect(rich.build.count).toBe(3);
    expect(rich.build.recentSuccessfulManifest).toMatchObject({
      id: manifestTwoId,
      buildRunId: buildTwoId,
      buildRevision: 2,
    });
  });

  it("counts repeated real Staging attempts while awaiting Production only changes execution", async () => {
    const rich = (await list({ query: "2.4.1" })).items[0];
    expect(rich.deployment).toMatchObject({
      count: 2,
      latest: {
        environmentRole: "staging",
        environmentName: "Staging",
        status: "completed",
        artifactManifestId: manifestTwoId,
        buildRunId: buildTwoId,
      },
    });
    expect(rich.lastExecution).toMatchObject({
      step: "production",
      sourceType: "release_run",
      status: "awaiting_approval",
    });
  });

  it("keeps lastExecution distinct from furthest progress and applies tie priority", async () => {
    const rebuild = (await list({ query: "2.4.2" })).items[0];
    expect(rebuild.deployment.count).toBe(1);
    expect(rebuild.lastExecution).toMatchObject({
      step: "build",
      sourceType: "build_run",
      status: "failed",
    });
    const tie = (await list({ query: "2.4.5" })).items[0];
    expect(tie.lastExecution).toMatchObject({
      step: "production",
      sourceType: "release_run",
      status: "awaiting_approval",
    });
  });

  it("uses only the exact locked identity branch when no Build exists", async () => {
    const draft = (await list({ query: "2.4.0" })).items[0];
    expect(draft.source).toEqual({
      branch: "main",
      commitSha: null,
      buildRunId: null,
      buildRevision: null,
      buildStatus: null,
    });
    expect(draft.lastExecution).toMatchObject({
      step: "preflight",
      sourceType: "order_created",
    });
  });

  it("fails closed for adversarial Manifest, BuildRun and ReleaseRun relations", async () => {
    const ids = adversarialIds();
    try {
      await seedAdversarialRelations(ids);

      const { result: bounded, queryCount } = await countedList({ take: 1 });
      expect(queryCount).toBe(2);
      expect(bounded.total).toBe(keepBrowserFixture ? 52 : 5);
      expect(bounded.items).toHaveLength(1);
      expect(bounded.items[0].id).toBe(tieOrderId);

      const search = await list({ query: "2.4.1" });
      expect(search.total).toBe(1);
      const rich = search.items[0];
      expect(rich.id).toBe(richOrderId);
      expect(rich.deployment).toMatchObject({
        count: 2,
        latest: {
          id: `f419-rich-deploy-2-${suffix}`,
          buildRunId: buildTwoId,
        },
      });
      expect(rich.lastExecution).toMatchObject({
        sourceType: "release_run",
        sourceId: `f419-rich-release-${suffix}`,
        step: "production",
        status: "awaiting_approval",
      });
      for (const untrustedId of [...ids.builds, ...ids.releaseRuns]) {
        expect(JSON.stringify(rich)).not.toContain(untrustedId);
      }
    } finally {
      if (!keepBrowserFixture) await removeAdversarialRelations(ids);
    }
  });

  function list(input: {
    query?: string;
    status?: ReleaseOrderListStatus;
    take?: number;
  }) {
    return service.list(teamId, actorId, projectId, {
      ...input,
      take: input.take ?? 50,
    });
  }

  async function countedList(input: {
    query?: string;
    status?: ReleaseOrderListStatus;
    take?: number;
  }) {
    let queryCount = 0;
    const countingPrisma = {
      $transaction: <T>(
        operation: (
          transaction: Pick<Prisma.TransactionClient, "$queryRaw">,
        ) => Promise<T>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) =>
        prisma.$transaction(
          (transaction) =>
            operation({
              $queryRaw: ((query: Prisma.Sql) => {
                queryCount += 1;
                return transaction.$queryRaw(query);
              }) as Prisma.TransactionClient["$queryRaw"],
            }),
          options,
        ),
    } as unknown as PrismaService;
    const countedService = new ReleaseOrderListService(
      new ReleaseOrderListRepository(countingPrisma),
    );
    const result = await countedService.list(teamId, actorId, projectId, {
      ...input,
      take: input.take ?? 50,
    });
    return { result, queryCount };
  }

  function adversarialIds() {
    return {
      builds: [
        `f419-drift-rr-order-build-${suffix}`,
        `f419-drift-rr-project-build-${suffix}`,
        `f419-drift-rr-team-build-${suffix}`,
        `f419-drift-rr-digest-build-${suffix}`,
        `f419-drift-deploy-order-build-${suffix}`,
        `f419-drift-deploy-project-build-${suffix}`,
        `f419-drift-deploy-team-build-${suffix}`,
      ],
      manifests: [
        `f419-drift-rr-order-manifest-${suffix}`,
        `f419-drift-rr-project-manifest-${suffix}`,
        `f419-drift-rr-team-manifest-${suffix}`,
        `f419-drift-rr-digest-manifest-${suffix}`,
        `f419-drift-deploy-order-manifest-${suffix}`,
        `f419-drift-deploy-project-manifest-${suffix}`,
        `f419-drift-deploy-team-manifest-${suffix}`,
      ],
      deployments: [
        `f419-drift-deploy-order-${suffix}`,
        `f419-drift-deploy-project-${suffix}`,
        `f419-drift-deploy-team-${suffix}`,
      ],
      releaseRuns: [
        `f419-drift-rr-order-${suffix}`,
        `f419-drift-rr-project-${suffix}`,
        `f419-drift-rr-team-${suffix}`,
        `f419-drift-rr-digest-${suffix}`,
      ],
    };
  }

  async function seedAdversarialRelations(
    ids: ReturnType<typeof adversarialIds>,
  ) {
    const [
      rrOrder,
      rrProject,
      rrTeam,
      rrDigest,
      depOrder,
      depProject,
      depTeam,
    ] = ids.builds;
    await prisma.buildRun.createMany({
      data: [
        build(draftOrderId, rrOrder, 101, "g", "succeeded", 0),
        {
          ...build(richOrderId, rrProject, 101, "h", "succeeded", 0),
          projectId: otherProjectId,
        },
        {
          ...build(richOrderId, rrTeam, 102, "i", "succeeded", 0),
          teamId: otherTeamId,
        },
        build(draftOrderId, rrDigest, 102, "j", "succeeded", 0),
        build(rebuildOrderId, depOrder, 101, "k", "succeeded", 0),
        {
          ...build(richOrderId, depProject, 104, "l", "succeeded", 0),
          projectId: otherProjectId,
        },
        {
          ...build(richOrderId, depTeam, 105, "m", "succeeded", 0),
          teamId: otherTeamId,
        },
      ],
    });
    const [
      rrOrderManifest,
      rrProjectManifest,
      rrTeamManifest,
      rrDigestManifest,
      depOrderManifest,
      depProjectManifest,
      depTeamManifest,
    ] = ids.manifests;
    const digests = ["g", "h", "i", "j", "k", "l", "m"].map(
      (value) => `sha256:${value.repeat(64)}`,
    );
    await prisma.artifactManifest.createMany({
      data: [
        manifest(rrOrderManifest, draftOrderId, rrOrder, digests[0], 0),
        {
          ...manifest(rrProjectManifest, richOrderId, rrProject, digests[1], 0),
          projectId: otherProjectId,
        },
        {
          ...manifest(rrTeamManifest, richOrderId, rrTeam, digests[2], 0),
          teamId: otherTeamId,
        },
        manifest(rrDigestManifest, richOrderId, rrDigest, digests[3], 0),
        manifest(depOrderManifest, richOrderId, depOrder, digests[4], 0),
        manifest(depProjectManifest, richOrderId, depProject, digests[5], 0),
        manifest(depTeamManifest, richOrderId, depTeam, digests[6], 0),
      ],
    });
    await prisma.deploymentRun.createMany({
      data: ids.deployments.map((id, index) =>
        deployment(
          id,
          richOrderId,
          ids.manifests[index + 4],
          stagingId,
          "completed",
          19 + index,
        ),
      ),
    });
    await prisma.releaseRun.createMany({
      data: ids.releaseRuns.map((id, index) => ({
        ...releaseRun(
          id,
          richOrderId,
          ids.manifests[index],
          "succeeded",
          20 + index,
        ),
        verifiedDigest: index === 3 ? digestTwo : digests[index],
      })),
    });
  }

  async function removeAdversarialRelations(
    ids: ReturnType<typeof adversarialIds>,
  ) {
    await prisma.releaseRun.deleteMany({
      where: { id: { in: ids.releaseRuns } },
    });
    await prisma.deploymentRun.deleteMany({
      where: { id: { in: ids.deployments } },
    });
    await prisma.artifactManifest.deleteMany({
      where: { id: { in: ids.manifests } },
    });
    await prisma.buildRun.deleteMany({ where: { id: { in: ids.builds } } });
  }

  async function seedProjects() {
    await prisma.project.createMany({
      data: [
        {
          id: projectId,
          teamId,
          createdById: actorId,
          name: "F419",
          config: {},
        },
        {
          id: otherProjectId,
          teamId: otherTeamId,
          createdById: actorId,
          name: "Other",
          config: {},
        },
      ],
    });
    const identity = await prisma.projectRepositoryIdentity.create({
      data: {
        teamId,
        projectId,
        provider: "github",
        canonicalKey: `github.com/f419/${suffix}`,
        canonicalUrl: `https://github.com/f419/${suffix}`,
        lockedAt: time(1),
      },
    });
    const revision = await prisma.projectRepositoryIdentityRevision.create({
      data: {
        teamId,
        projectId,
        identityId: identity.id,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: "a".repeat(40),
        reason: "F419 exact identity",
        idempotencyKey: `identity-${suffix}`,
      },
    });
    await prisma.projectRepositoryIdentity.update({
      where: { id: identity.id },
      data: { currentRevisionId: revision.id },
    });
    await prisma.projectEnvironment.createMany({
      data: [
        {
          id: stagingId,
          teamId,
          projectId,
          key: "staging",
          name: "Staging",
          baselineRole: "staging",
        },
        {
          id: productionId,
          teamId,
          projectId,
          key: "production",
          name: "Production",
          baselineRole: "production",
        },
      ],
    });
  }

  async function seedOrders() {
    await prisma.releaseOrder.createMany({
      data: [
        order(
          richOrderId,
          "2.4.1",
          "active",
          "failed build keeps prior manifest",
          2,
        ),
        order(draftOrderId, "2.4.0", "draft", "newer draft", 10),
        order(rebuildOrderId, "2.4.2", "active", "rebuilt after Staging", 3),
        order(
          specialOrderId,
          "2.4.4",
          "draft",
          "literal 50%_\\=ready O'Reilly 发布说明",
          4,
        ),
        order(tieOrderId, "2.4.5", "active", "tie priority", 5),
        {
          ...order(
            `f419-other-order-${suffix}`,
            "2.4.1",
            "active",
            "other-team-secret",
            6,
          ),
          teamId: otherTeamId,
          projectId: otherProjectId,
        },
      ],
    });
  }

  async function seedRichExecutions() {
    await prisma.buildRun.createMany({
      data: [
        build(richOrderId, buildOneId, 1, "a", "succeeded", 11),
        build(richOrderId, buildTwoId, 2, "b", "succeeded", 12),
        build(richOrderId, buildThreeId, 3, "c", "failed", 15),
      ],
    });
    await prisma.artifactManifest.createMany({
      data: [
        manifest(
          manifestOneId,
          richOrderId,
          buildOneId,
          `sha256:${"a".repeat(64)}`,
          11,
        ),
        manifest(manifestTwoId, richOrderId, buildTwoId, digestTwo, 12),
      ],
    });
    await prisma.deploymentRun.createMany({
      data: [
        deployment(
          `f419-rich-deploy-1-${suffix}`,
          richOrderId,
          manifestTwoId,
          stagingId,
          "failed",
          13,
        ),
        deployment(
          `f419-rich-deploy-2-${suffix}`,
          richOrderId,
          manifestTwoId,
          stagingId,
          "completed",
          14,
        ),
      ],
    });
    await prisma.releaseRun.create({
      data: releaseRun(
        `f419-rich-release-${suffix}`,
        richOrderId,
        manifestTwoId,
        "awaiting_approval",
        16,
      ),
    });
  }

  async function seedRebuildExecutions() {
    const succeededBuildId = `f419-rebuild-build-1-${suffix}`;
    const failedBuildId = `f419-rebuild-build-2-${suffix}`;
    const manifestId = `f419-rebuild-manifest-${suffix}`;
    await prisma.buildRun.createMany({
      data: [
        build(rebuildOrderId, succeededBuildId, 1, "d", "succeeded", 11),
        build(rebuildOrderId, failedBuildId, 2, "e", "failed", 14),
      ],
    });
    await prisma.artifactManifest.create({
      data: manifest(
        manifestId,
        rebuildOrderId,
        succeededBuildId,
        `sha256:${"d".repeat(64)}`,
        11,
      ),
    });
    await prisma.deploymentRun.create({
      data: deployment(
        `f419-rebuild-deploy-${suffix}`,
        rebuildOrderId,
        manifestId,
        stagingId,
        "completed",
        13,
      ),
    });
  }

  async function seedTieExecutions() {
    const buildId = `f419-tie-build-${suffix}`;
    const manifestId = `f419-tie-manifest-${suffix}`;
    await prisma.buildRun.create({
      data: build(tieOrderId, buildId, 1, "f", "succeeded", 18),
    });
    await prisma.artifactManifest.create({
      data: manifest(
        manifestId,
        tieOrderId,
        buildId,
        `sha256:${"f".repeat(64)}`,
        18,
      ),
    });
    await prisma.deploymentRun.create({
      data: deployment(
        `f419-tie-deploy-${suffix}`,
        tieOrderId,
        manifestId,
        productionId,
        "completed",
        18,
      ),
    });
    await prisma.releaseRun.create({
      data: releaseRun(
        `f419-tie-release-${suffix}`,
        tieOrderId,
        manifestId,
        "awaiting_approval",
        18,
        `sha256:${"f".repeat(64)}`,
      ),
    });
  }

  async function seedBrowserFillers() {
    await prisma.releaseOrder.createMany({
      data: Array.from({ length: 47 }, (_, index) => ({
        id: `f419-filler-${String(index + 1).padStart(2, "0")}-${suffix}`,
        teamId,
        projectId,
        createdById: actorId,
        releaseVersion: `1.0.${String(index + 1).padStart(2, "0")}`,
        status: "draft",
        note: `Browser pagination fixture ${index + 1}`,
        createdAt: new Date(
          `2026-08-01T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
        ),
      })),
    });
  }

  function order(
    id: string,
    releaseVersion: string,
    status: string,
    note: string,
    hour: number,
  ) {
    return {
      id,
      teamId,
      projectId,
      createdById: actorId,
      releaseVersion,
      status,
      note,
      createdAt: time(hour),
    };
  }

  function build(
    releaseOrderId: string,
    id: string,
    revision: number,
    commit: string,
    status: string,
    hour: number,
  ) {
    return {
      id,
      teamId,
      projectId,
      releaseOrderId,
      triggeredById: actorId,
      revision,
      sourceBranch: "main",
      sourceCommitSha: commit.repeat(40),
      inputSnapshot: {},
      inputHash: commit.repeat(64),
      status,
      startedAt: time(hour),
      finishedAt: time(hour),
      createdAt: time(hour),
    };
  }

  function manifest(
    id: string,
    releaseOrderId: string,
    buildRunId: string,
    digest: string,
    hour: number,
  ) {
    return {
      id,
      teamId,
      projectId,
      releaseOrderId,
      buildRunId,
      digest,
      createdAt: time(hour),
    };
  }

  function deployment(
    id: string,
    releaseOrderId: string,
    artifactManifestId: string,
    environmentId: string,
    status: string,
    hour: number,
  ) {
    return {
      id,
      teamId,
      projectId,
      actorId,
      environmentId,
      artifactManifestId,
      environment: environmentId === stagingId ? "staging" : "production",
      source: "release_order",
      targetType: "docker-compose",
      dryRun: false,
      status,
      startedAt: time(hour),
      finishedAt: time(hour),
      createdAt: time(hour),
      params: { releaseOrderId },
    };
  }

  function releaseRun(
    id: string,
    releaseOrderId: string,
    artifactManifestId: string,
    status: string,
    hour: number,
    verifiedDigest = digestTwo,
  ) {
    return {
      id,
      teamId,
      projectId,
      releaseOrderId,
      environmentId: productionId,
      artifactManifestId,
      actorId,
      status,
      verifiedDigest,
      inputHash: "f".repeat(64),
      idempotencyKey: `${id}-key`,
      createdAt: time(hour),
      updatedAt: time(hour),
    };
  }

  function time(hour: number) {
    return new Date(`2026-08-04T${String(hour).padStart(2, "0")}:00:00.000Z`);
  }
});
