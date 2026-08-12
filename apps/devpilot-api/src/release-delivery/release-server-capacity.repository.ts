import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type CapacityEvidenceIdentity = {
  teamId: string;
  projectId: string;
  environmentId: string;
  configRevisionId: string;
  buildRunId: string;
  manifestId: string;
  providerKey: string;
  bindingId: string;
  deploymentInputHash: string;
  workloadInputHash: string;
  requirementHash: string;
  sampledBucket: Date;
};

@Injectable()
export class ReleaseServerCapacityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findFresh(identity: CapacityEvidenceIdentity) {
    const { sampledBucket: _bucket, ...subject } = identity;
    return this.prisma.serverCapacitySnapshot.findFirst({
      where: { ...subject, expiresAt: { gte: new Date() } },
      orderBy: [{ sampledAt: "desc" }, { id: "desc" }],
    });
  }

  async create(input: CapacityEvidenceIdentity & {
    measurementHash: string;
    status: string;
    requirements: object;
    measurement: object;
    reasonCode: string;
    sampledAt: Date;
    expiresAt: Date;
  }) {
    try {
      return await this.prisma.serverCapacitySnapshot.create({ data: input });
    } catch (cause) {
      if (!(cause instanceof Prisma.PrismaClientKnownRequestError) || cause.code !== "P2002") {
        throw cause;
      }
      const exact = await this.prisma.serverCapacitySnapshot.findFirst({ where: {
        deploymentInputHash: input.deploymentInputHash,
        workloadInputHash: input.workloadInputHash,
        requirementHash: input.requirementHash,
        providerKey: input.providerKey,
        bindingId: input.bindingId,
        sampledBucket: input.sampledBucket,
      } });
      if (!exact) throw cause;
      return exact;
    }
  }
}
