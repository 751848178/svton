import type { PrismaService } from "../prisma/prisma.service";
import {
  deploymentInitializationFingerprint,
  ReleaseInitializationEvidenceService,
} from "./release-initialization-evidence.service";
import type {
  EvidenceScopeInput,
  ReleaseInitializationEvidenceRef,
} from "./release-initialization-evidence.types";

const CMD = "node dist/bootstrap.js";
const FINGERPRINT = deploymentInitializationFingerprint(CMD)!;

function mkRef(over: Partial<ReleaseInitializationEvidenceRef> = {}): ReleaseInitializationEvidenceRef {
  return {
    teamId: "team-1",
    projectId: "project-1",
    environmentId: "env-1",
    applicationServiceId: "service-1",
    releasePlanId: "plan-1",
    releaseStageId: "stage-bootstrap",
    releaseStageAttemptId: "attempt-1",
    serverExecutionJobId: "sej-1",
    commandFingerprint: FINGERPRINT,
    ...over,
  };
}

function mkScope(over: Partial<EvidenceScopeInput> = {}): EvidenceScopeInput {
  return {
    teamId: "team-1",
    projectId: "project-1",
    environmentId: "env-1",
    applicationServiceId: "service-1",
    commandFingerprint: FINGERPRINT,
    ...over,
  };
}

describe("ReleaseInitializationEvidenceService", () => {
  it("verify returns verified when scope, fingerprint, status and attempt all match", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: "checkpoint-1",
        teamId: "team-1",
        projectId: "project-1",
        environmentId: "env-1",
        applicationServiceId: "service-1",
        commandFingerprint: FINGERPRINT,
        status: "completed",
        releasePlanId: "plan-1",
        releaseStageId: "stage-bootstrap",
        releaseStageAttemptId: "attempt-1",
        serverExecutionJobId: "sej-1",
      });
    const attemptFindUnique = jest.fn().mockResolvedValue({
      id: "attempt-1",
      status: "succeeded",
      releaseStageId: "stage-bootstrap",
    });
    const prisma = {
      applicationServiceInitialization: { findUnique },
      releaseStageAttempt: { findUnique: attemptFindUnique },
    } as unknown as PrismaService;
    const service = new ReleaseInitializationEvidenceService(prisma);

    const result = await service.verify(mkScope(), mkRef());
    expect(result).toEqual({ status: "verified", checkpointId: "checkpoint-1" });
  });

  it("verify is fail-closed when checkpoint row is missing", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      applicationServiceInitialization: { findUnique },
      releaseStageAttempt: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new ReleaseInitializationEvidenceService(prisma);
    const result = await service.verify(mkScope(), mkRef());
    expect(result.status).toBe("mismatch");
  });

  it("verify is fail-closed on scope mismatch (projectId)", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "checkpoint-1",
      teamId: "team-1",
      projectId: "OTHER-project",
      environmentId: "env-1",
      applicationServiceId: "service-1",
      commandFingerprint: FINGERPRINT,
      status: "completed",
      releaseStageAttemptId: "attempt-1",
      releaseStageId: "stage-bootstrap",
      serverExecutionJobId: "sej-1",
    });
    const prisma = {
      applicationServiceInitialization: { findUnique },
      releaseStageAttempt: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new ReleaseInitializationEvidenceService(prisma);
    const result = await service.verify(mkScope(), mkRef());
    expect(result).toMatchObject({ status: "mismatch", reason: expect.stringContaining("project") });
  });

  it("verify is fail-closed on fingerprint mismatch", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "checkpoint-1",
      teamId: "team-1",
      projectId: "project-1",
      environmentId: "env-1",
      applicationServiceId: "service-1",
      commandFingerprint: "DIFFERENT-FINGERPRINT",
      status: "completed",
      releaseStageAttemptId: "attempt-1",
      releaseStageId: "stage-bootstrap",
      serverExecutionJobId: "sej-1",
    });
    const prisma = {
      applicationServiceInitialization: { findUnique },
      releaseStageAttempt: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new ReleaseInitializationEvidenceService(prisma);
    const result = await service.verify(mkScope(), mkRef());
    // fingerprint 不匹配会被 scope 校验先行拦截（row.fingerprint != scope.fingerprint）
    expect(result.status).toBe("mismatch");
    expect(result).toMatchObject({ status: "mismatch", reason: expect.stringContaining("fingerprint") });
  });

  it("verify is fail-closed when checkpoint status is not completed", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "checkpoint-1",
      teamId: "team-1",
      projectId: "project-1",
      environmentId: "env-1",
      applicationServiceId: "service-1",
      commandFingerprint: FINGERPRINT,
      status: "reserved",
      releaseStageAttemptId: "attempt-1",
      releaseStageId: "stage-bootstrap",
      serverExecutionJobId: "sej-1",
    });
    const prisma = {
      applicationServiceInitialization: { findUnique },
      releaseStageAttempt: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new ReleaseInitializationEvidenceService(prisma);
    const result = await service.verify(mkScope(), mkRef());
    expect(result).toMatchObject({ status: "mismatch", reason: expect.stringContaining("未完成") });
  });

  it("verify is fail-closed when parent attempt is not succeeded", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "checkpoint-1",
      teamId: "team-1",
      projectId: "project-1",
      environmentId: "env-1",
      applicationServiceId: "service-1",
      commandFingerprint: FINGERPRINT,
      status: "completed",
      releaseStageAttemptId: "attempt-1",
      releaseStageId: "stage-bootstrap",
      serverExecutionJobId: "sej-1",
    });
    const attemptFindUnique = jest.fn().mockResolvedValue({
      id: "attempt-1",
      status: "failed",
      releaseStageId: "stage-bootstrap",
    });
    const prisma = {
      applicationServiceInitialization: { findUnique },
      releaseStageAttempt: { findUnique: attemptFindUnique },
    } as unknown as PrismaService;
    const service = new ReleaseInitializationEvidenceService(prisma);
    const result = await service.verify(mkScope(), mkRef());
    expect(result).toMatchObject({ status: "mismatch", reason: expect.stringContaining("bootstrap attempt 未成功") });
  });

  it("verify is fail-closed when ref attempt id differs from checkpoint", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "checkpoint-1",
      teamId: "team-1",
      projectId: "project-1",
      environmentId: "env-1",
      applicationServiceId: "service-1",
      commandFingerprint: FINGERPRINT,
      status: "completed",
      releaseStageAttemptId: "attempt-OTHER",
      releaseStageId: "stage-bootstrap",
      serverExecutionJobId: "sej-1",
    });
    const prisma = {
      applicationServiceInitialization: { findUnique },
      releaseStageAttempt: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new ReleaseInitializationEvidenceService(prisma);
    const result = await service.verify(mkScope(), mkRef());
    expect(result).toMatchObject({ status: "mismatch", reason: expect.stringContaining("attempt 引用不一致") });
  });

  describe("record", () => {
    it("creates a completed checkpoint with parent linkage when none exists", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const create = jest.fn().mockResolvedValue({ id: "checkpoint-new" });
      const prisma = {
        applicationServiceInitialization: { findUnique, create },
      } as unknown as PrismaService;
      const service = new ReleaseInitializationEvidenceService(prisma);
      const id = await service.record(mkRef());
      expect(id).toBe("checkpoint-new");
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "completed",
            releasePlanId: "plan-1",
            releaseStageId: "stage-bootstrap",
            releaseStageAttemptId: "attempt-1",
            serverExecutionJobId: "sej-1",
            releaseEvidenceStatus: "verified",
          }),
        }),
      );
    });

    it("updates existing row to completed + parent linkage (idempotent)", async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: "checkpoint-existing",
        finishedAt: null,
      });
      const update = jest.fn().mockResolvedValue({ id: "checkpoint-existing" });
      const prisma = {
        applicationServiceInitialization: { findUnique, update },
      } as unknown as PrismaService;
      const service = new ReleaseInitializationEvidenceService(prisma);
      const id = await service.record(mkRef());
      expect(id).toBe("checkpoint-existing");
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "checkpoint-existing" },
          data: expect.objectContaining({
            status: "completed",
            releaseStageAttemptId: "attempt-1",
            releaseEvidenceStatus: "verified",
          }),
        }),
      );
    });
  });
});
