import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EnvironmentVersionGateEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    deploymentRunId: string;
    logs: string[];
    result: Record<string, unknown>;
  }) {
    const updated = await this.prisma.deploymentRun.updateMany({
      where: { id: input.deploymentRunId, status: "running" },
      data: {
        logs: input.logs,
        result: input.result as Prisma.InputJsonValue,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException("Production 部署证据状态已变化");
    }
  }
}
