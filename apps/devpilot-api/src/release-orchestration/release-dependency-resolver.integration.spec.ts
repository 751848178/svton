/**
 * F383 P0-2 依赖解析器集成测试：在一次性 MySQL 8 上验证真实 ReleaseDependencyResolverService
 * 的 optional warning 结构化回传（不再只 logger.warn）+ required 缺失 fail-closed + 自依赖阻断。
 *
 * 运行方式：
 *   docker run -d --rm --name svton-mysql-rel -e MYSQL_ROOT_PASSWORD=x -e MYSQL_DATABASE=rel -p 3399:3306 mysql:8
 *   DATABASE_URL="mysql://root:x@localhost:3399/rel" npx prisma migrate deploy
 *   DATABASE_URL="mysql://root:x@localhost:3399/rel" RUN_RELEASE_INTEGRATION=1 \
 *     npx jest src/release-orchestration/release-dependency-resolver.integration.spec.ts
 *
 * 未设置 DATABASE_URL=...3399 或 RUN_RELEASE_INTEGRATION=1 时整体跳过（默认 CI 行为）。
 */
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseDependencyResolverService } from "./release-dependency-resolver.service";
import type { ResolvedReleaseService } from "./release-plan-access.service";

const DB_URL = process.env.DATABASE_URL ?? "";
const isIntegration =
  DB_URL.includes("3399") || process.env.RUN_RELEASE_INTEGRATION === "1";
const describeIntegration = isIntegration
  ? describe
  : (describe.skip as jest.Describe);

describeIntegration("F383 P0-2: ReleaseDependencyResolver (real MySQL)", () => {
  let prisma: PrismaService;
  let resolver: ReleaseDependencyResolverService;
  let teamId: string;
  let projectId: string;
  let envId: string;
  let backendId: string;
  let adminId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    resolver = new ReleaseDependencyResolverService(prisma);

    // 唯一前缀避免与其他集成套件碰撞（两套件共享 :3399，串行运行）。
    const p = "p2" + Date.now().toString(36);
    const team = await prisma.team.create({
      data: { id: `team-${p}`, name: `t-${p}` },
    });
    teamId = team.id;
    const user = await prisma.user.create({
      data: { id: `user-${p}`, email: `${p}@test.local` },
    });
    const project = await prisma.project.create({
      data: { id: `proj-${p}`, teamId, createdById: user.id, name: `proj-${p}`, config: {} },
    });
    projectId = project.id;
    const env = await prisma.projectEnvironment.create({
      data: {
        id: `env-${p}`, teamId, projectId, key: "prod", name: "prod", status: "active",
      },
    });
    envId = env.id;
    const app = await prisma.application.create({
      data: { id: `app-${p}`, teamId, projectId, name: "app" },
    });
    backendId = `svc-be-${p}`;
    adminId = `svc-ad-${p}`;
    await prisma.applicationService.create({
      data: {
        id: backendId, teamId, projectId, applicationId: app.id, environmentId: envId,
        name: "backend", deployConfig: { deployCommand: "make deploy-be" },
      },
    });
    await prisma.applicationService.create({
      data: {
        id: adminId, teamId, projectId, applicationId: app.id, environmentId: envId,
        name: "admin", deployConfig: { deployCommand: "make deploy-ad" },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function svc(id: string, name: string): ResolvedReleaseService {
    return {
      applicationId: `app-${id}`,
      applicationServiceId: id,
      environmentId: envId,
      serviceName: name,
      deployCommand: "make deploy",
    } as ResolvedReleaseService;
  }

  it("optional target not selected → structured warning returned (not just logged)", async () => {
    // backend 声明 optional 依赖 admin，但本次只选 backend → warning + drop。
    await prisma.applicationService.update({
      where: { id: backendId },
      data: {
        deployConfig: {
          deployCommand: "make deploy-be",
          releaseDependencies: [
            {
              toServiceId: adminId,
              fromStageType: "health_check",
              toStageType: "application_deploy",
              conditionType: "succeeded",
              required: false,
            },
          ],
        },
      },
    });
    const result = await resolver.resolveDependencies(teamId, projectId, envId, [
      svc(backendId, "backend"),
    ]);
    expect(result.edges).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toEqual(
      expect.objectContaining({
        code: "RELEASE_DEP_TARGET_NOT_SELECTED",
        applicationServiceId: backendId,
        serviceName: "backend",
        toServiceId: adminId,
        dependencyIndex: 0,
      }),
    );
  });

  it("required target not selected → throws 400 (fail-closed)", async () => {
    await prisma.applicationService.update({
      where: { id: backendId },
      data: {
        deployConfig: {
          deployCommand: "make deploy-be",
          releaseDependencies: [
            {
              toServiceId: adminId,
              fromStageType: "health_check",
              toStageType: "application_deploy",
              conditionType: "succeeded",
              required: true,
            },
          ],
        },
      },
    });
    await expect(
      resolver.resolveDependencies(teamId, projectId, envId, [
        svc(backendId, "backend"),
      ]),
    ).rejects.toMatchObject({
      response: {
        code: "RELEASE_PLAN_INVALID",
        details: [
          expect.objectContaining({
            code: "RELEASE_DEP_TARGET_NOT_SELECTED",
            toServiceId: adminId,
          }),
        ],
      },
    });
  });

  it("both selected + required edge → edge returned, no warnings", async () => {
    await prisma.applicationService.update({
      where: { id: backendId },
      data: {
        deployConfig: {
          deployCommand: "make deploy-be",
          releaseDependencies: [
            {
              toServiceId: adminId,
              fromStageType: "health_check",
              toStageType: "application_deploy",
              conditionType: "succeeded",
              required: true,
            },
          ],
        },
      },
    });
    const result = await resolver.resolveDependencies(teamId, projectId, envId, [
      svc(backendId, "backend"),
      svc(adminId, "admin"),
    ]);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].toServiceId).toBe(adminId);
    expect(result.warnings).toEqual([]);
  });

  it("non-array releaseDependencies (string) → throws 400 INVALID_FIELD_TYPE", async () => {
    await prisma.applicationService.update({
      where: { id: backendId },
      data: {
        deployConfig: {
          deployCommand: "make deploy-be",
          releaseDependencies: "not-an-array",
        },
      },
    });
    await expect(
      resolver.resolveDependencies(teamId, projectId, envId, [
        svc(backendId, "backend"),
      ]),
    ).rejects.toMatchObject({
      response: {
        code: "RELEASE_PLAN_INVALID",
        details: [
          expect.objectContaining({
            code: "RELEASE_DEP_INVALID_FIELD_TYPE",
            field: "releaseDependencies",
            invalidValue: "not-an-array",
          }),
        ],
      },
    });
  });
});
