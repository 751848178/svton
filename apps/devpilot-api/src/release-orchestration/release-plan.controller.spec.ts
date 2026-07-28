/**
 * ReleasePlanController 单元测试（F383 Slice 8a）：
 *   - capability 端点：flag on/off、projectId RBAC
 *   - 环境一致性拒绝：preview/create 在 ReleasePlanAccessService 阶段
 *     拦截跨环境/不属于项目团队的服务（403）
 *
 * 不接 DB——prisma / accessPolicy / service / access service 全部 mock。
 * ReleasePlanAccessService 的 DB 路径独立测试（见 release-plan-access.service.spec.ts）。
 */
import { ForbiddenException } from "@nestjs/common";
import { ReleasePlanController } from "./release-plan.controller";
import { ControlAccessPolicyService } from "../control-access-policy";
import { ReleasePlanAccessService } from "./release-plan-access.service";

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
    // 真实的 access service（持有 prisma）；测试可覆盖其行为。
    const accessService = new ReleasePlanAccessService(prisma as never);
    if (opts.accessServiceAssert) {
      accessService.assertAndResolve = opts.accessServiceAssert as never;
    }
    const stageActionService = {
      retryStage: jest.fn().mockResolvedValue(undefined),
      reRequestApproval: jest.fn().mockResolvedValue(undefined),
      skipStage: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new ReleasePlanController(
      service as never,
      stageActionService as never,
      access as unknown as ControlAccessPolicyService,
      prisma as never,
      accessService,
    );
    return { controller, service, access, prisma, accessService };
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

    it("preview: cross-service edge to a service NOT in selection is dropped", async () => {
      // admin 未被选中 → backend 声明指向 admin 的边被丢弃（不阻断发布）。
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
          findMany: jest.fn().mockResolvedValue([{ id: "svc-backend", deployConfig: backendCfg }]),
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
      expect(call.serviceDependencies).toEqual([]);
    });
  });
});
