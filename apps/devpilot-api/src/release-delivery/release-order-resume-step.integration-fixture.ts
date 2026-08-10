import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const ORDER_KEYS = [
  "preflight",
  "buildFailed",
  "stagingRetry",
  "productionRun",
  "productionMismatch",
  "invalid",
  "foreignManifest",
  "withdrawBefore",
  "withdrawStaging",
  "archived",
] as const;

export class ReleaseOrderResumeStepFixture {
  readonly suffix = randomUUID();
  readonly userId = `f421-user-${this.suffix}`;
  readonly teamId = `f421-team-${this.suffix}`;
  readonly otherTeamId = `f421-other-team-${this.suffix}`;
  readonly projectId = `f421-project-${this.suffix}`;
  readonly otherProjectId = `f421-other-project-${this.suffix}`;
  readonly archivedProjectId = `f421-archived-project-${this.suffix}`;
  readonly stagingId = `f421-staging-${this.suffix}`;
  readonly productionId = `f421-production-${this.suffix}`;
  readonly developmentId = `f421-development-${this.suffix}`;
  readonly archivedStagingId = `f421-archived-staging-${this.suffix}`;
  readonly ids = Object.fromEntries(
    ORDER_KEYS.map((key) => [key, `f421-${key}-${this.suffix}`]),
  ) as Record<(typeof ORDER_KEYS)[number], string>;
  readonly keep = process.env.KEEP_F421_BROWSER_FIXTURE === "1";

  constructor(readonly prisma: PrismaClient) {}

  async setup() {
    await this.prisma.user.create({
      data: {
        id: this.userId,
        email: `${this.suffix}@f421.example`,
        role: this.keep ? "admin" : "user",
        passwordHash: this.keep
          ? await bcrypt.hash(process.env.F421_BROWSER_PASSWORD || "", 10)
          : null,
      },
    });
    await this.prisma.team.createMany({
      data: [
        { id: this.teamId, name: "F421 Team" },
        { id: this.otherTeamId, name: "F421 Other Team" },
      ],
    });
    await this.prisma.project.createMany({
      data: [
        this.project(this.projectId, this.teamId, "F421 Resume"),
        this.project(this.otherProjectId, this.otherTeamId, "F421 Other"),
        this.project(this.archivedProjectId, this.teamId, "F421 Archived"),
      ],
    });
    await this.prisma.teamMember.create({
      data: { teamId: this.teamId, userId: this.userId, role: "owner" },
    });
    await this.prisma.projectEnvironment.createMany({
      data: [
        this.environment(this.stagingId, this.projectId, "staging"),
        this.environment(this.productionId, this.projectId, "production"),
        this.environment(this.developmentId, this.projectId, "development"),
        {
          ...this.environment(
            this.archivedStagingId,
            this.archivedProjectId,
            "staging",
          ),
          status: "archived",
        },
      ],
    });
    await this.prisma.releaseOrder.createMany({
      data: ORDER_KEYS.map((key, index) => ({
        id: this.ids[key],
        teamId: this.teamId,
        projectId: key === "archived" ? this.archivedProjectId : this.projectId,
        createdById: this.userId,
        releaseVersion: `f421-${index}`,
        note: `F421 ${key}`,
        status: key.startsWith("withdraw") ? "canceled" : "draft",
        createdAt: this.at(index * 10),
        updatedAt: this.at(index * 10 + 9),
      })),
    });
    await this.seedEvidence();
  }

  async cleanup() {
    if (this.keep) {
      console.log(
        "F421_BROWSER_FIXTURE",
        JSON.stringify({
          email: `${this.suffix}@f421.example`,
          teamId: this.teamId,
          projectId: this.projectId,
          ids: this.ids,
        }),
      );
      await this.prisma.$disconnect();
      return;
    }
    const projects = [
      this.projectId,
      this.otherProjectId,
      this.archivedProjectId,
    ];
    const where = { projectId: { in: projects } };
    await this.prisma.deploymentRun.deleteMany({ where });
    await this.prisma.releaseRun.deleteMany({ where });
    await this.prisma.auditEvent.deleteMany({ where });
    await this.prisma.artifactManifest.deleteMany({ where });
    await this.prisma.buildRun.deleteMany({ where });
    await this.prisma.releaseOrder.deleteMany({ where });
    await this.prisma.projectEnvironment.deleteMany({ where });
    await this.prisma.project.deleteMany({ where: { id: { in: projects } } });
    await this.prisma.teamMember.deleteMany({ where: { userId: this.userId } });
    await this.prisma.team.deleteMany({
      where: { id: { in: [this.teamId, this.otherTeamId] } },
    });
    await this.prisma.user.delete({ where: { id: this.userId } });
    await this.prisma.$disconnect();
  }

  // The compact fixture helpers keep this test-only source below the 200-line ceiling.
  // prettier-ignore
  private async seedEvidence() {
    await this.build("buildFailed", "failed", 0, 11);
    const staging = await this.build("stagingRetry", "succeeded", 0, 21);
    await this.deploy("stagingRetry", staging, this.stagingId, false, 23, "blocked");
    await this.build("stagingRetry", "failed", 1, 25);
    const production = await this.build("productionRun", "succeeded", 0, 31);
    await this.release("productionRun", production, production.digest, 34);
    const mismatch = await this.build("productionMismatch", "succeeded", 0, 41);
    await this.deploy("productionMismatch", mismatch, this.productionId, false, 44);
    const invalid = await this.build("invalid", "succeeded", 0, 51);
    await this.deploy("invalid", invalid, this.stagingId, true, 53);
    await this.deploy("invalid", invalid, this.developmentId, false, 54);
    await this.deploy("invalid", invalid, this.stagingId, false, 55, "completed", true);
    const foreign = await this.build("foreignManifest", "succeeded", 0, 61);
    await this.release("invalid", foreign, foreign.digest, 56);
    await this.release("invalid", invalid, `sha256:${"f".repeat(64)}`, 57);
    const withdrawn = await this.build("withdrawStaging", "succeeded", 0, 81);
    await this.deploy("withdrawStaging", withdrawn, this.stagingId, false, 83);
    const archived = await this.build("archived", "succeeded", 0, 91, this.archivedProjectId);
    await this.deploy("archived", archived, this.archivedStagingId, false, 93);
    await this.withdraw("withdrawBefore", 79);
    await this.withdraw("withdrawStaging", 89);
  }

  private project(id: string, teamId: string, name: string) {
    return { id, teamId, createdById: this.userId, name, config: {} };
  }

  // prettier-ignore
  private environment(id: string, projectId: string, role: string) {
    return { id, teamId: this.teamId, projectId, key: role, name: role, baselineRole: role };
  }

  // prettier-ignore
  private async build(key: keyof typeof this.ids, status: string, revision: number, hour: number, projectId = this.projectId) {
    const releaseOrderId = this.ids[key];
    const id = `${releaseOrderId}-build-${revision}`;
    await this.prisma.buildRun.create({ data: { id, teamId: this.teamId, projectId, releaseOrderId, triggeredById: this.userId, revision, sourceBranch: "main", sourceCommitSha: "a".repeat(40), inputSnapshot: {}, inputHash: "b".repeat(64), status, startedAt: this.at(hour), finishedAt: this.at(hour + 1), createdAt: this.at(hour) } });
    if (status !== "succeeded") return { id, manifestId: "", digest: "" };
    const manifestId = `${id}-manifest`;
    const digest = `sha256:${"c".repeat(63)}${revision}`;
    await this.prisma.artifactManifest.create({ data: { id: manifestId, teamId: this.teamId, projectId, releaseOrderId, buildRunId: id, digest, createdAt: this.at(hour + 1) } });
    return { id, manifestId, digest };
  }

  // prettier-ignore
  private deploy(key: keyof typeof this.ids, manifest: { manifestId: string }, environmentId: string, dryRun: boolean, hour: number, status = "completed", wrongScope = false) {
    const projectId = wrongScope ? this.otherProjectId : key === "archived" ? this.archivedProjectId : this.projectId;
    return this.prisma.deploymentRun.create({ data: { id: `${this.ids[key]}-deploy-${hour}`, teamId: wrongScope ? this.otherTeamId : this.teamId, projectId, actorId: this.userId, environmentId, artifactManifestId: manifest.manifestId, environment: "fixture", source: "release_order", targetType: "release-artifact", dryRun, status, startedAt: this.at(hour), finishedAt: this.at(hour + 1), createdAt: this.at(hour) } });
  }

  // prettier-ignore
  private release(key: keyof typeof this.ids, manifest: { manifestId: string }, verifiedDigest: string, hour: number) {
    return this.prisma.releaseRun.create({ data: { id: `${this.ids[key]}-release-${hour}`, teamId: this.teamId, projectId: this.projectId, releaseOrderId: this.ids[key], environmentId: this.productionId, artifactManifestId: manifest.manifestId, actorId: this.userId, status: "running", verifiedDigest, inputHash: "d".repeat(64), idempotencyKey: `${this.ids[key]}-${hour}`, startedAt: this.at(hour), createdAt: this.at(hour) } });
  }

  // prettier-ignore
  private withdraw(key: keyof typeof this.ids, hour: number) {
    return this.prisma.auditEvent.create({ data: { teamId: this.teamId, actorId: this.userId, projectId: this.projectId, category: "release", action: "project.release_order.withdraw", targetType: "release_order", targetId: this.ids[key], risk: "high", status: "completed", occurredAt: this.at(hour) } });
  }

  private at(hour: number) {
    return new Date(Date.UTC(2026, 7, 5, hour));
  }
}
