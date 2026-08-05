import { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { readdir } from "node:fs/promises";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { gatePolicyTestDouble } from "./release-gate-test-decision.spec-utils";
import { ReleaseBuildRealGitFixture } from "./release-build-real-git.fixture";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";

export class ReleaseBuildHttpRuntimeFixture {
  readonly git = new ReleaseBuildRealGitFixture();
  app!: INestApplication;
  baseUrl = "";
  token = "";
  serviceId = "";

  async start() {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ReleaseGateDecisionService)
      .useFactory({
        inject: [PrismaService],
        factory: (prisma: PrismaService) => gatePolicyTestDouble(prisma),
      })
      .compile();
    this.app = module.createNestApplication();
    this.app.setGlobalPrefix("api");
    await this.app.init();
    await this.app.listen(0, "127.0.0.1");
    this.baseUrl = await this.app.getUrl();
    await this.git.start();
    await this.seedBuildCommand();
    this.token = this.app.get(JwtService).sign({
      sub: this.git.userId,
      email: `${this.git.suffix}@f416-git.example`,
      role: "user",
    });
  }

  async stop() {
    if (this.app) await this.app.close();
    await this.git.stop();
  }

  request(path: string, init?: RequestInit) {
    return fetch(`${this.baseUrl}/api${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        "x-team-id": this.git.teamId,
        ...(init?.headers || {}),
      },
    });
  }

  async waitForRunningBuild() {
    return this.poll(async () => {
      const response = await this.request(this.buildsPath());
      if (!response.ok)
        throw new Error(`Build list failed: ${response.status}`);
      const body = (await response.json()) as { data?: { items?: Build[] } };
      return body.data?.items?.find((run) => run.status === "running");
    });
  }

  async waitForCleanup() {
    const workRoot = String(process.env.RELEASE_BUILD_WORK_ROOT);
    await this.poll(async () => {
      const entries = await readdir(workRoot);
      const runtime = await readdir(`${workRoot}/runtime`);
      return entries.every((entry) => entry === "runtime") &&
        runtime.length === 0
        ? true
        : undefined;
    });
  }

  buildsPath() {
    return `/projects/${this.git.projectId}/delivery/releases/${this.git.orderId}/builds`;
  }

  async configureBuild(deployConfig: Record<string, unknown>) {
    await this.git.prisma.applicationService.update({
      where: { id: this.serviceId },
      data: { deployConfig: deployConfig as Prisma.InputJsonValue },
    });
  }

  private async seedBuildCommand() {
    const prisma = this.git.prisma;
    await prisma.teamMember.create({
      data: { teamId: this.git.teamId, userId: this.git.userId, role: "owner" },
    });
    const environment = await prisma.projectEnvironment.create({
      data: {
        teamId: this.git.teamId,
        projectId: this.git.projectId,
        key: "test",
        name: "Test",
      },
    });
    const application = await prisma.application.create({
      data: {
        teamId: this.git.teamId,
        projectId: this.git.projectId,
        createdById: this.git.userId,
        name: "api",
        repoPath: ".",
      },
    });
    const service = await prisma.applicationService.create({
      data: {
        teamId: this.git.teamId,
        projectId: this.git.projectId,
        applicationId: application.id,
        environmentId: environment.id,
        name: "api",
        deployConfig: {
          workingDirectory: ".",
          buildCommand: 'node -e "setTimeout(() => {}, 30000)"',
          artifactPaths: ["dist"],
        },
      },
    });
    this.serviceId = service.id;
  }

  private async poll<T>(read: () => Promise<T | undefined>) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const value = await read();
      if (value !== undefined) return value;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }
    throw new Error("F426 HTTP runtime poll timed out");
  }
}

export interface Build {
  id: string;
  revision: number;
  status: string;
  errorCode: string | null;
  manifest: unknown;
}
