import type { PrismaService } from "../prisma/prisma.service";
import {
  DeploymentInitializationCheckpointService,
  deploymentInitializationFingerprint,
} from "./deployment-initialization-checkpoint.service";

describe("DeploymentInitializationCheckpointService", () => {
  it("scopes a successful command to service, environment, and fingerprint", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "checkpoint-1",
      status: "completed",
      deploymentRunId: "run-1",
      leaseExpiresAt: null,
    });
    const service = new DeploymentInitializationCheckpointService({
      applicationServiceInitialization: { findUnique },
    } as unknown as PrismaService);

    const decision = await service.inspect({
      teamId: "team-1",
      projectId: "project-1",
      applicationServiceId: "service-1",
      environmentId: "environment-1",
      command: "node dist/bootstrap.js",
    });

    expect(decision).toMatchObject({
      status: "skipped_already_completed",
      checkpointId: "checkpoint-1",
      commandFingerprint: deploymentInitializationFingerprint(
        "node dist/bootstrap.js",
      ),
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        applicationServiceId_environmentId_commandFingerprint: {
          applicationServiceId: "service-1",
          environmentId: "environment-1",
          commandFingerprint: decision.commandFingerprint,
        },
      },
    });
  });

  it("blocks initialization without both service and environment scope", async () => {
    const service = new DeploymentInitializationCheckpointService(
      {} as PrismaService,
    );
    await expect(
      service.inspect({
        teamId: "team-1",
        projectId: "project-1",
        command: "node dist/bootstrap.js",
      }),
    ).resolves.toMatchObject({ status: "blocked_missing_scope" });
  });
});
