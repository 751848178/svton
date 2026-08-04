import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { ProjectZipArtifact } from "./generator.service";

const CLAIM_LEASE_MS = 5 * 60_000;
const CLAIM_POLL_MS = 100;
const CLAIM_POLL_LIMIT = 300;

export interface GeneratedArtifactSelection {
  artifact: ProjectZipArtifact;
  resolvedResources: unknown;
}

export type GeneratedArtifactClaimResult =
  | { kind: "owned"; ownerToken: string }
  | ({ kind: "selected" } & GeneratedArtifactSelection);

@Injectable()
export class GeneratedProjectArtifactClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(teamId: string, projectId: string): Promise<GeneratedArtifactClaimResult> {
    const ownerToken = randomUUID();
    for (let attempt = 0; attempt < CLAIM_POLL_LIMIT; attempt += 1) {
      const now = new Date();
      try {
        await this.prisma.generatedProjectArtifactClaim.create({
          data: {
            projectId,
            teamId,
            ownerToken,
            leaseExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
          },
        });
        return { kind: "owned", ownerToken };
      } catch (error) {
        if (!isUniqueError(error)) throw error;
      }

      const existing = await this.prisma.generatedProjectArtifactClaim.findUnique({
        where: { projectId },
      });
      if (!existing) continue;
      if (existing.status === "selected") return readSelection(existing);
      if (existing.leaseExpiresAt && existing.leaseExpiresAt <= now) {
        const replaced = await this.prisma.generatedProjectArtifactClaim.updateMany({
          where: {
            projectId,
            teamId,
            status: "claimed",
            leaseExpiresAt: { lte: now },
          },
          data: {
            ownerToken,
            leaseExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
          },
        });
        if (replaced.count === 1) return { kind: "owned", ownerToken };
      }
      await delay(CLAIM_POLL_MS);
    }
    throw new ConflictException({
      code: "GENERATED_PROJECT_ARTIFACT_BUSY",
      message: "项目生成包正在由另一个请求创建",
      remediation: "请使用同一幂等键重试。",
    });
  }

  async adoptSelected(
    teamId: string,
    projectId: string,
    selection: GeneratedArtifactSelection,
  ): Promise<GeneratedArtifactSelection> {
    try {
      const record = await this.prisma.generatedProjectArtifactClaim.create({
        data: {
          projectId,
          teamId,
          ownerToken: "adopted",
          status: "selected",
          artifact: selection.artifact as unknown as Prisma.InputJsonObject,
          resolvedResources: asJson(selection.resolvedResources),
          selectedAt: new Date(),
        },
      });
      return readSelection(record);
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      return this.readSelected(projectId);
    }
  }

  async select(
    teamId: string,
    projectId: string,
    ownerToken: string,
    selection: GeneratedArtifactSelection,
  ): Promise<GeneratedArtifactSelection> {
    const selected = await this.prisma.generatedProjectArtifactClaim.updateMany({
      where: { projectId, teamId, ownerToken, status: "claimed" },
      data: {
        status: "selected",
        artifact: selection.artifact as unknown as Prisma.InputJsonObject,
        resolvedResources: asJson(selection.resolvedResources),
        leaseExpiresAt: null,
        selectedAt: new Date(),
      },
    });
    if (selected.count === 1) return selection;
    return this.readSelected(projectId);
  }

  async findSelected(projectId: string): Promise<GeneratedArtifactSelection | null> {
    const record = await this.prisma.generatedProjectArtifactClaim.findUnique({
      where: { projectId },
    });
    return record?.status === "selected" ? readSelection(record) : null;
  }

  release(teamId: string, projectId: string, ownerToken: string) {
    return this.prisma.generatedProjectArtifactClaim.deleteMany({
      where: { projectId, teamId, ownerToken, status: "claimed" },
    });
  }

  private async readSelected(projectId: string): Promise<GeneratedArtifactSelection> {
    const record = await this.prisma.generatedProjectArtifactClaim.findUnique({
      where: { projectId },
    });
    if (!record || record.status !== "selected") {
      throw new ConflictException({ code: "GENERATED_PROJECT_ARTIFACT_CLAIM_LOST" });
    }
    return readSelection(record);
  }
}

function readSelection(record: { artifact: unknown; resolvedResources: unknown }) {
  const artifact = record.artifact as ProjectZipArtifact | null;
  if (!artifact || artifact.kind !== "project_zip" || !artifact.fileName) {
    throw new ConflictException({ code: "GENERATED_PROJECT_ARTIFACT_SELECTION_INVALID" });
  }
  return { kind: "selected" as const, artifact, resolvedResources: record.resolvedResources };
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? []) as Prisma.InputJsonValue;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
