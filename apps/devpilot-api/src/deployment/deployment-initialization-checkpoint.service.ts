import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ServerExecutionResult } from "../server-executor";
import {
  failDeploymentInitializationCheckpoint,
  finishDeploymentInitializationCheckpoint,
} from "./deployment-initialization-checkpoint.repository";
import type { DeploymentInitializationDecision } from "./deployment-initialization.types";

type ScopeInput = {
  teamId: string;
  projectId: string;
  applicationServiceId?: string | null;
  environmentId?: string | null;
  command?: string;
};

type ReserveInput = ScopeInput & { deploymentRunId: string };

const LEASE_MS = 60 * 60 * 1000;

export function deploymentInitializationFingerprint(command?: string) {
  if (!command?.trim()) return undefined;
  return createHash("sha256").update(command.trim()).digest("hex");
}

@Injectable()
export class DeploymentInitializationCheckpointService {
  constructor(private readonly prisma: PrismaService) {}

  async inspect(input: ScopeInput): Promise<DeploymentInitializationDecision> {
    const fingerprint = deploymentInitializationFingerprint(input.command);
    if (!fingerprint) return { status: "not_configured" };
    if (!input.applicationServiceId || !input.environmentId) {
      return {
        status: "blocked_missing_scope",
        commandFingerprint: fingerprint,
        skipReason: "一次性初始化需要明确的应用服务和项目环境",
      };
    }
    const checkpoint = await this.find(input, fingerprint);
    return this.toDecision(checkpoint, fingerprint);
  }

  async reserve(
    input: ReserveInput,
  ): Promise<DeploymentInitializationDecision> {
    const fingerprint = deploymentInitializationFingerprint(input.command);
    if (!fingerprint || !input.applicationServiceId || !input.environmentId) {
      return this.inspect(input);
    }
    const existing = await this.find(input, fingerprint);
    const decision = this.toDecision(existing, fingerprint);
    if (
      decision.status === "skipped_already_completed" ||
      decision.status === "blocked_in_progress"
    ) {
      return decision;
    }
    const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
    try {
      const checkpoint = existing
        ? await this.prisma.applicationServiceInitialization.update({
            where: { id: existing.id },
            data: {
              status: "reserved",
              deploymentRunId: input.deploymentRunId,
              attempt: { increment: 1 },
              error: null,
              startedAt: new Date(),
              finishedAt: null,
              leaseExpiresAt,
            },
          })
        : await this.prisma.applicationServiceInitialization.create({
            data: {
              teamId: input.teamId,
              projectId: input.projectId,
              environmentId: input.environmentId,
              applicationServiceId: input.applicationServiceId,
              commandFingerprint: fingerprint,
              status: "reserved",
              deploymentRunId: input.deploymentRunId,
              startedAt: new Date(),
              leaseExpiresAt,
            },
          });
      return {
        status: existing ? "retry_after_failure" : "reserved",
        checkpointId: checkpoint.id,
        commandFingerprint: fingerprint,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return this.inspect(input);
      }
      throw error;
    }
  }

  async finish(
    checkpointId: string | undefined,
    execution: ServerExecutionResult,
  ): Promise<string | undefined> {
    return finishDeploymentInitializationCheckpoint(
      this.prisma,
      checkpointId,
      execution,
    );
  }

  async fail(checkpointId: string | undefined, error: unknown) {
    return failDeploymentInitializationCheckpoint(
      this.prisma,
      checkpointId,
      error,
    );
  }

  private find(input: ScopeInput, fingerprint: string) {
    if (!input.applicationServiceId || !input.environmentId) return null;
    return this.prisma.applicationServiceInitialization.findUnique({
      where: {
        applicationServiceId_environmentId_commandFingerprint: {
          applicationServiceId: input.applicationServiceId,
          environmentId: input.environmentId,
          commandFingerprint: fingerprint,
        },
      },
    });
  }

  private toDecision(
    checkpoint: Awaited<
      ReturnType<DeploymentInitializationCheckpointService["find"]>
    >,
    fingerprint: string,
  ): DeploymentInitializationDecision {
    if (!checkpoint)
      return { status: "planned", commandFingerprint: fingerprint };
    if (checkpoint.status === "completed") {
      return {
        status: "skipped_already_completed",
        checkpointId: checkpoint.id,
        commandFingerprint: fingerprint,
        skipReason: "同一初始化命令已在当前环境成功执行",
      };
    }
    if (
      checkpoint.status === "reserved" &&
      checkpoint.leaseExpiresAt &&
      checkpoint.leaseExpiresAt > new Date()
    ) {
      return {
        status: "blocked_in_progress",
        checkpointId: checkpoint.id,
        commandFingerprint: fingerprint,
        ownerDeploymentRunId: checkpoint.deploymentRunId || undefined,
      };
    }
    return { status: "retry_after_failure", commandFingerprint: fingerprint };
  }
}
