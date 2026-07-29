/**
 * ReleasePlanController 单元测试（F383 Slice 8a）：
 *   - capability 端点：flag on/off、projectId RBAC
 *   - 环境一致性拒绝：preview/create 在 ReleasePlanAccessService 阶段
 *     拦截跨环境/不属于项目团队的服务（403）
 *
 * 不接 DB——prisma / accessPolicy / service / access service 全部 mock。
 * ReleasePlanAccessService 的 DB 路径独立测试（见 release-plan-access.service.spec.ts）。
 */
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ReleasePlanController } from "./release-plan.controller";
import { ControlAccessPolicyService } from "../control-access-policy";
import { ReleasePlanAccessService } from "./release-plan-access.service";
import { ReleaseDependencyResolverService } from "./release-dependency-resolver.service";
import { ReleasePlanAccessGuard } from "./release-plan-access.guard";
import { ReleasePlanOrchestratorService } from "./release-plan-orchestrator.service";

interface PrismaLike {
  project: { findFirst: jest.Mock };
  projectEnvironment: { findFirst: jest.Mock };
  applicationService: { findFirst: jest.Mock; findMany: jest.Mock };
  projectEnvironmentServer: { findFirst: jest.Mock };
}

function makePrisma(over: Partial<PrismaLike> = {}): PrismaLike {
  return {
    project: { findFirst: jest.fn().mockResolvedValue({ id: "proj-1" }) },
    projectEnvironment: { findFirst: jest.fn().mockResolvedValue({ id: "env-1" }) },
    applicationService: {
      findFirst: jest.fn().mockResolvedValue(null),
      // P0-1: resolveServiceDependencies 批量拉取已选服务 deployConfig。
      // 默认返回空（无 releaseDependencies 声明）。
      findMany: jest.fn().mockResolvedValue([]),
    },
    projectEnvironmentServer: { findFirst: jest.fn().mockResolvedValue(null) },
    ...over,
  };
}

const req = { user: { id: "user-1" }, teamId: "team-1" };

describe("ReleasePlanController", () => {
  function build(opts: {
    enabled?: boolean;
    accessAllowWrite?: boolean;
    prisma?: PrismaLike;
    accessServiceAssert?: jest.Mock;
  } = {}) {
    const enabled = opts.enabled ?? true;
    const service = {
      isEnabled: jest.fn(() => enabled),
      preview: jest.fn(),
      create: jest.fn(),
    };
    const access = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanWrite: jest
        .fn()
        .mockResolvedValue(opts.accessAllowWrite ?? true
          ? { allowed: true }
          : Promise.reject(new Error("rbac deny"))),
      canRead: jest.fn(),
    };
    const prisma = opts.prisma ?? makePrisma();
    // 真实的 access service + dependency resolver（持有 prisma）；测试可覆盖其行为。
    const dependencyResolver = new ReleaseDependencyResolverService(prisma as never);
    const accessService = new ReleasePlanAccessService(prisma as never, dependencyResolver);
    if (opts.accessServiceAssert) {
      accessService.assertAndResolve = opts.accessServiceAssert as never;
    }
    const accessGuard = new ReleasePlanAccessGuard(
      prisma as never,
      access as unknown as ControlAccessPolicyService,
    );
    const executorPreflight = {
      computeWarnings: jest.fn().mockResolvedValue([]),
    };
    const orchestrator = new ReleasePlanOrchestratorService(
      prisma as never,
      service as never,
      accessService,
      executorPreflight as never,
    );
    const stageActionService = {
      retryStage: jest.fn().mockResolvedValue(undefined),
      reRequestApproval: jest.fn().mockResolvedValue(undefined),
      skipStage: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new ReleasePlanController(
      service as never,
      stageActionService as never,
      accessGuard,
      orchestrator,
    );
    return { controller, service, access, prisma, accessService, dependencyResolver };
  }

  describe("capability endpoint", () => {
    it("flag on → {enabled:true, canCancel:true, reason:null}", async () => {
      const { controller } = build({ enabled: true });
      await expect(controller.capability(req)).resolves.toEqual({
        enabled: true,
        canCancel: true,
        canWrite: undefined,
        reason: null,
      });
    });

    it("flag off → {enabled:false, canCancel:true, reason:'flag_off'}", async () => {
      const { controller } = build({ enabled: false });
      await expect(controller.capability(req)).resolves.toEqual({
        enabled: false,
        canCancel: true,
        canWrite: undefined,
        reason: "flag_off",
      });
    });

    it("projectId + write allowed → canWrite:true", async () => {
      const { controller } = build({ enabled: true, accessAllowWrite: true });
      await expect(controller.capability(req, "proj-1")).resolves.toMatchObject({
        enabled: true,
        canWrite: true,
      });
    });

    it("projectId + no write access → canWrite:false", async () => {
      const { controller } = build({ enabled: true, accessAllowWrite: false });
      await expect(controller.capability(req, "proj-1")).resolves.toMatchObject({
        enabled: true,
        canWrite: false,
      });
    });
  });

  describe("preview/create env-consistency rejection", () => {
    const baseDto = (over: Partial<{
      environmentId: string;
      services: Array<{
        applicationId: string;
        applicationServiceId: string;
        environmentId: string;
        serviceName: string;
        serverId?: string;
      }>;
    }> = {}) => ({
      environmentId: "env-prod",
      name: "release-1",
      services: [
        {
          applicationId: "app-1",
          applicationServiceId: "svc-1",
          environmentId: "env-prod",
          serviceName: "svc",
        },
      ],
      ...over,
    });

    it("preview: service environmentId differs from plan → 403 RELEASE_ENVIRONMENT_MISMATCH", async () => {
      // access service 真实路径：prisma.applicationService.findFirst 返回 null（DB miss），
      // 但 environmentId mismatch 在更早抛出（无需 DB）。
      const { controller, service } = build();
      const dto = baseDto({
        services: [
          {
            applicationId: "app-1",
            applicationServiceId: "svc-1",
            environmentId: "env-dev",
            serviceName: "svc",
          },
        ],
      });
      await expect(controller.preview(req as never, "proj-1", dto as never)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        controller.preview(req as never, "proj-1", dto as never),
      ).rejects.toMatchObject({
        response: { code: "RELEASE_ENVIRONMENT_MISMATCH" },
      });
      expect(service.preview).not.toHaveBeenCalled();
    });

    it("create: service not in project/team/env → 403 RELEASE_SERVICE_NOT_IN_TARGET_ENV", async () => {
      // environmentId 一致但 ApplicationService 查不到 → 第二道闸
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
        },
      });
      const { controller, service } = build({ prisma });
      const dto = baseDto();
      await expect(controller.create(req as never, "proj-1", dto as never)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        controller.create(req as never, "proj-1", dto as never),
      ).rejects.toMatchObject({
        response: { code: "RELEASE_SERVICE_NOT_IN_TARGET_ENV" },
      });
      expect(service.create).not.toHaveBeenCalled();
    });

    it("create: DTO serverId belongs to env via ProjectEnvironmentServer → allowed", async () => {
      const deployConfig = {
        deployment: { deployCommand: "make deploy", healthCheckUrl: "http://h" },
      };
      const appSvc = {
        id: "svc-1",
        serverId: "srv-native",
        environmentId: "env-prod",
        deployConfig,
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue(appSvc),
          findMany: jest.fn().mockResolvedValue([{ id: "svc-1", deployConfig }]),
        },
        projectEnvironmentServer: { findFirst: jest.fn().mockResolvedValue({ id: "bind-1" }) },
      });
      const { controller, service } = build({ prisma });
      const dto = baseDto({
        services: [
          {
            applicationId: "app-1",
            applicationServiceId: "svc-1",
            environmentId: "env-prod",
            serviceName: "svc",
            serverId: "srv-other",
          },
        ],
      });
      await controller.create(req as never, "proj-1", dto as never);
      expect(service.create).toHaveBeenCalledTimes(1);
      const call = service.create.mock.calls[0][0];
      // commands resolved server-side from deployConfig (DTO did not supply them)
      expect(call.services[0].deployCommand).toBe("make deploy");
      expect(call.services[0].healthCheckUrl).toBe("http://h");
      expect(call.services[0].serverId).toBe("srv-other");
      // P0-1: cross-service dependencies resolved server-side; none declared → empty array
      expect(call.serviceDependencies).toEqual([]);
      // controller must NOT echo a client-supplied serviceDependencies
      expect(dto).not.toHaveProperty("serviceDependencies");
    });

    it("preview: client serviceDependencies ignored; server resolves from deployConfig", async () => {
      // P0-1: 即使客户端在 body 里塞了 serviceDependencies，controller 也不消费——
      // 依赖边只由服务端从 deployConfig.releaseDependencies 解析。
      const backendCfg = {
        deployCommand: "make deploy-backend",
        healthCheckUrl: "http://backend/healthz",
        releaseDependencies: [
          {
            toServiceId: "svc-admin",
            fromStageType: "health_check",
            toStageType: "application_deploy",
            conditionType: "succeeded",
            required: true,
          },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockImplementation(async (args: { where: { id: string } }) => {
            if (args.where.id === "svc-backend") {
              return { id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: backendCfg };
            }
            return { id: "svc-admin", serverId: null, environmentId: "env-prod", deployConfig: {} };
          }),
          findMany: jest.fn().mockResolvedValue([
            { id: "svc-backend", deployConfig: backendCfg },
            { id: "svc-admin", deployConfig: {} },
          ]),
        },
      });
      const { controller, service } = build({ prisma });
      // client attempts to inject a fake edge in the body — controller must ignore it.
      const dto = {
        ...baseDto({
          services: [
            {
              applicationId: "app-backend",
              applicationServiceId: "svc-backend",
              environmentId: "env-prod",
              serviceName: "backend",
            },
            {
              applicationId: "app-admin",
              applicationServiceId: "svc-admin",
              environmentId: "env-prod",
              serviceName: "admin",
            },
          ],
        }),
        serviceDependencies: [{ fromServiceId: "svc-admin", toServiceId: "svc-backend" }],
      };
      await controller.preview(req as never, "proj-1", dto as never);
      expect(service.preview).toHaveBeenCalledTimes(1);
      const call = service.preview.mock.calls[0][0];
      // server-resolved edge: backend:health_check → admin:application_deploy
      expect(call.serviceDependencies).toEqual([
        {
          fromServiceId: "svc-backend",
          fromStageType: "health_check",
          toServiceId: "svc-admin",
          toStageType: "application_deploy",
          conditionType: "succeeded",
          required: true,
        },
      ]);
    });

    it("preview: REQUIRED cross-service edge to a service NOT in selection → 400 RELEASE_DEP_TARGET_NOT_SELECTED (Item 1 fail-closed)", async () => {
      // admin 在同 scope 存在但未被选中 → required 依赖必须 fail-closed，不再静默丢弃。
      const backendCfg = {
        deployCommand: "make deploy-backend",
        healthCheckUrl: "http://backend/healthz",
        releaseDependencies: [
          { toServiceId: "svc-admin", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded", required: true },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: backendCfg,
          }),
          // same-scope probe returns admin（存在但未选）→ RELEASE_DEP_TARGET_NOT_SELECTED
          findMany: jest.fn().mockImplementation(async (args: { where: { id?: { in?: string[] }; environmentId?: string } }) => {
            const ids = args.where.id?.in ?? [];
            if (args.where.environmentId) {
              return ids.map((id) => ({ id, deployConfig: id === "svc-backend" ? backendCfg : {} }));
            }
            // unscoped probe（区分跨域/不存在）—— admin 在同 scope 命中，不应走到这里
            return ids.map((id) => ({ id, teamId: "team-1", projectId: "proj-1", environmentId: "env-prod" }));
          }),
        },
      });
      const { controller, service } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await expect(controller.preview(req as never, "proj-1", dto as never)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.preview(req as never, "proj-1", dto as never),
      ).rejects.toMatchObject({
        response: {
          code: "RELEASE_PLAN_INVALID",
          details: [{ code: "RELEASE_DEP_TARGET_NOT_SELECTED", toServiceId: "svc-admin" }],
        },
      });
      expect(service.preview).not.toHaveBeenCalled();
    });

    it("preview: OPTIONAL cross-service edge to a service NOT in selection → warning + dropped (not silent)", async () => {
      // required=false + 未选（但同 scope 存在）→ 记 warning 并丢弃，不阻断（也不静默）。
      const backendCfg = {
        deployCommand: "make deploy-backend",
        releaseDependencies: [
          { toServiceId: "svc-admin", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded", required: false },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: backendCfg,
          }),
          findMany: jest.fn().mockImplementation(async (args: { where: { id?: { in?: string[] }; environmentId?: string } }) => {
            const ids = args.where.id?.in ?? [];
            if (args.where.environmentId) {
              // same-scope probe: backend (deployConfig) + admin（存在但未选）
              return ids.map((id) => ({ id, deployConfig: id === "svc-backend" ? backendCfg : {} }));
            }
            return [];
          }),
        },
      });
      const { controller, service } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await controller.preview(req as never, "proj-1", dto as never);
      const call = service.preview.mock.calls[0][0];
      // optional 未选 → 丢弃（不阻断），serviceDependencies 为空
      expect(call.serviceDependencies).toEqual([]);
      // P0-2(b)：warning 必须结构化回传（不再只 logger.warn），携带可定位字段。
      expect(call.dependencyWarnings).toHaveLength(1);
      expect(call.dependencyWarnings[0]).toEqual(
        expect.objectContaining({
          code: "RELEASE_DEP_TARGET_NOT_SELECTED",
          applicationServiceId: "svc-backend",
          serviceName: "backend",
          dependencyIndex: 0,
          toServiceId: "svc-admin",
        }),
      );
      expect(call.dependencyWarnings[0].suggestedAction).toMatch(/请先将该服务加入本次发布/);
    });

    it("preview: non-array top-level releaseDependencies → 400 INVALID_FIELD_TYPE (P0-2a fail-closed)", async () => {
      const backendCfg = {
        deployCommand: "make deploy-backend",
        releaseDependencies: "bad-string-not-array",
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: backendCfg,
          }),
          findMany: jest.fn().mockResolvedValue([{ id: "svc-backend", deployConfig: backendCfg }]),
        },
      });
      const { controller } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await expect(controller.preview(req as never, "proj-1", dto as never)).rejects.toMatchObject({
        response: {
          code: "RELEASE_PLAN_INVALID",
          details: [
            expect.objectContaining({
              code: "RELEASE_DEP_INVALID_FIELD_TYPE",
              field: "releaseDependencies",
              invalidValue: "bad-string-not-array",
            }),
          ],
        },
      });
    });

    it("preview: non-array deployment.releaseDependencies → 400 INVALID_FIELD_TYPE (P0-2a)", async () => {
      const backendCfg = {
        deployCommand: "make deploy-backend",
        deployment: { releaseDependencies: { not: "an-array" } },
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: backendCfg,
          }),
          findMany: jest.fn().mockResolvedValue([{ id: "svc-backend", deployConfig: backendCfg }]),
        },
      });
      const { controller } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await expect(controller.preview(req as never, "proj-1", dto as never)).rejects.toMatchObject({
        response: {
          code: "RELEASE_PLAN_INVALID",
          details: [
            expect.objectContaining({
              code: "RELEASE_DEP_INVALID_FIELD_TYPE",
              field: "releaseDependencies",
              invalidValue: { not: "an-array" },
            }),
          ],
        },
      });
    });

    it("preview: self-dependency → 400 RELEASE_DEP_SELF_DEPENDENCY (Item 1 §5)", async () => {
      const cfg = {
        deployConfig: { deployCommand: "x" },
        releaseDependencies: [
          { toServiceId: "svc-backend", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: cfg,
          }),
          findMany: jest.fn().mockResolvedValue([{ id: "svc-backend", deployConfig: cfg }]),
        },
      });
      const { controller } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await expect(controller.preview(req as never, "proj-1", dto as never)).rejects.toMatchObject({
        response: {
          code: "RELEASE_PLAN_INVALID",
          details: [{ code: "RELEASE_DEP_SELF_DEPENDENCY" }],
        },
      });
    });

    it("preview: target does not exist anywhere → 400 RELEASE_DEP_TARGET_NOT_FOUND (Item 1 §8)", async () => {
      const cfg = {
        releaseDependencies: [
          { toServiceId: "svc-ghost", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: cfg,
          }),
          // same-scope 空 + unscoped 空 → 不存在
          findMany: jest.fn().mockResolvedValue([{ id: "svc-backend", deployConfig: cfg }]),
        },
      });
      const { controller } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await expect(controller.preview(req as never, "proj-1", dto as never)).rejects.toMatchObject({
        response: {
          code: "RELEASE_PLAN_INVALID",
          details: [{ code: "RELEASE_DEP_TARGET_NOT_FOUND", toServiceId: "svc-ghost" }],
        },
      });
    });

    it("preview: target exists in another project → 400 RELEASE_DEP_CROSS_SCOPE (Item 1 §9)", async () => {
      const cfg = {
        releaseDependencies: [
          { toServiceId: "svc-foreign", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: cfg,
          }),
          findMany: jest.fn().mockImplementation(async (args: { where: { id?: { in?: string[] }; environmentId?: string } }) => {
            const ids = args.where.id?.in ?? [];
            if (args.where.environmentId) {
              // same-scope: 只有 backend
              return ids.filter((id) => id === "svc-backend").map((id) => ({ id, deployConfig: cfg }));
            }
            // unscoped: foreign 存在但属于别的 project
            return ids.map((id) =>
              id === "svc-foreign"
                ? { id, teamId: "team-1", projectId: "proj-OTHER", environmentId: "env-OTHER" }
                : { id, teamId: "team-1", projectId: "proj-1", environmentId: "env-prod" },
            );
          }),
        },
      });
      const { controller } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await expect(controller.preview(req as never, "proj-1", dto as never)).rejects.toMatchObject({
        response: {
          code: "RELEASE_PLAN_INVALID",
          details: [{ code: "RELEASE_DEP_CROSS_SCOPE", toServiceId: "svc-foreign" }],
        },
      });
    });

    // Item 1 §4: preview 与 create 必须使用完全一致的校验逻辑
    it("preview↔create parity: same malformed dep blocks both endpoints identically", async () => {
      const cfg = {
        releaseDependencies: [
          { toServiceId: "svc-admin", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded", required: true },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: cfg,
          }),
          findMany: jest.fn().mockResolvedValue([{ id: "svc-backend", deployConfig: cfg }]),
        },
      });
      const { controller } = build({ prisma });
      const base = {
        environmentId: "env-prod",
        name: "release-1",
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      };
      const previewErr = controller.preview(req as never, "proj-1", base as never);
      const createErr = controller.create(req as never, "proj-1", { ...base, expectedPlanHash: "x" } as never);
      const [p, c] = await Promise.allSettled([previewErr, createErr]);
      expect(p.status).toBe("rejected");
      expect(c.status).toBe("rejected");
      const pErr = (p as PromiseRejectedResult).reason as BadRequestException;
      const cErr = (c as PromiseRejectedResult).reason as BadRequestException;
      const pBody = pErr.getResponse() as { code: string; details: { code: string }[] };
      const cBody = cErr.getResponse() as { code: string; details: { code: string }[] };
      expect(pBody.code).toBe(cBody.code);
      expect(pBody.details[0].code).toBe(cBody.details[0].code);
    });

    // CR B2 覆盖：optional 依赖指向不存在的服务 → warn+drop（不阻断），而非 400
    it("preview: OPTIONAL dep to non-existent service → warn + drop, not 400 (CR B2)", async () => {
      const cfg = {
        releaseDependencies: [
          { toServiceId: "svc-ghost", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded", required: false },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: cfg,
          }),
          findMany: jest.fn().mockResolvedValue([{ id: "svc-backend", deployConfig: cfg }]),
        },
      });
      const { controller, service } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await controller.preview(req as never, "proj-1", dto as never);
      expect(service.preview).toHaveBeenCalledTimes(1);
      expect(service.preview.mock.calls[0][0].serviceDependencies).toEqual([]);
    });

    // CR B2 覆盖：optional 依赖指向跨域服务 → warn+drop（不阻断）
    it("preview: OPTIONAL dep to cross-scope service → warn + drop, not 400 (CR B2)", async () => {
      const cfg = {
        releaseDependencies: [
          { toServiceId: "svc-foreign", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded", required: false },
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: cfg,
          }),
          findMany: jest.fn().mockImplementation(async (args: { where: { id?: { in?: string[] }; environmentId?: string } }) => {
            const ids = args.where.id?.in ?? [];
            if (args.where.environmentId) {
              return ids.filter((id) => id === "svc-backend").map((id) => ({ id, deployConfig: cfg }));
            }
            return ids.map((id) =>
              id === "svc-foreign"
                ? { id, teamId: "team-1", projectId: "proj-OTHER", environmentId: "env-OTHER" }
                : { id, teamId: "team-1", projectId: "proj-1", environmentId: "env-prod" },
            );
          }),
        },
      });
      const { controller, service } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await controller.preview(req as never, "proj-1", dto as never);
      expect(service.preview).toHaveBeenCalledTimes(1);
      expect(service.preview.mock.calls[0][0].serviceDependencies).toEqual([]);
    });

    // CR B1 回归：混合 [parser-error, valid-edge-to-unselected] → 两个错误的 dependencyIndex
    // 必须分别对齐用户配置里的真实位置（0-based 合并数组下标），不能都指向同一项
    it("CR B1: mixed parser-error + resolver-error in one response → distinct correct dependencyIndex", async () => {
      // 数组：[0]=畸形（parser error, index 0），[1]=合法边指向未选 admin（resolver error）
      const cfg = {
        releaseDependencies: [
          "garbage-entry", // index 0 → RELEASE_DEP_MALFORMED
          { toServiceId: "svc-admin", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded", required: true }, // index 1 → RELEASE_DEP_TARGET_NOT_SELECTED
        ],
      };
      const prisma = makePrisma({
        applicationService: {
          findFirst: jest.fn().mockResolvedValue({
            id: "svc-backend", serverId: null, environmentId: "env-prod", deployConfig: cfg,
          }),
          findMany: jest.fn().mockImplementation(async (args: { where: { id?: { in?: string[] }; environmentId?: string } }) => {
            const ids = args.where.id?.in ?? [];
            if (args.where.environmentId) {
              return ids.map((id) => ({ id, deployConfig: id === "svc-backend" ? cfg : {} }));
            }
            return [];
          }),
        },
      });
      const { controller } = build({ prisma });
      const dto = baseDto({
        services: [
          { applicationId: "app-backend", applicationServiceId: "svc-backend", environmentId: "env-prod", serviceName: "backend" },
        ],
      });
      await expect(controller.preview(req as never, "proj-1", dto as never)).rejects.toMatchObject({
        response: { code: "RELEASE_PLAN_INVALID" },
      });
      // 复跑以读取错误体（前一次已抛）
      let details: { code: string; dependencyIndex: number }[] = [];
      try {
        await controller.preview(req as never, "proj-1", dto as never);
      } catch (e) {
        details = ((e as BadRequestException).getResponse() as { details: { code: string; dependencyIndex: number }[] }).details;
      }
      const idxByCode = new Map(details.map((d) => [d.code, d.dependencyIndex]));
      expect(idxByCode.get("RELEASE_DEP_MALFORMED")).toBe(0);
      expect(idxByCode.get("RELEASE_DEP_TARGET_NOT_SELECTED")).toBe(1);
    });
  });
});
