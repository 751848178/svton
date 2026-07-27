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
  applicationService: { findFirst: jest.Mock };
  projectEnvironmentServer: { findFirst: jest.Mock };
}

function makePrisma(over: Partial<PrismaLike> = {}): PrismaLike {
  return {
    project: { findFirst: jest.fn().mockResolvedValue({ id: "proj-1" }) },
    projectEnvironment: { findFirst: jest.fn().mockResolvedValue({ id: "env-1" }) },
    applicationService: { findFirst: jest.fn().mockResolvedValue(null) },
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
    const controller = new ReleasePlanController(
      service as never,
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
        applicationService: { findFirst: jest.fn().mockResolvedValue(null) },
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
        applicationService: { findFirst: jest.fn().mockResolvedValue(appSvc) },
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
    });
  });
});
