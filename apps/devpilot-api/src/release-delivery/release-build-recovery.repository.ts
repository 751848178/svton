import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { buildLogReference, buildLogSummary } from "./release-build-log.utils";

@Injectable()
export class ReleaseBuildRecoveryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recoverInterrupted() {
    const interrupted = await this.prisma.buildRun.findMany({
      where: { status: { in: ["queued", "running"] } },
      select: { id: true },
    });
    let count = 0;
    for (const run of interrupted) {
      const code = "BUILD_EXECUTOR_RESTARTED";
      const message = "构建执行器重启，原运行已终止";
      const result = await this.prisma.buildRun.updateMany({
        where: { id: run.id, status: { in: ["queued", "running"] } },
        data: {
          status: "failed",
          errorCode: code,
          errorMessage: message,
          logReference: buildLogReference(run.id),
          logSummary: buildLogSummary([
            `result failed: ${code} ${message}`,
          ]) as Prisma.InputJsonValue,
          gateSummary: {
            build: { status: "failed" },
            action: "请重新创建 BuildRun。",
          },
          finishedAt: new Date(),
        },
      });
      count += result.count;
    }
    return { count };
  }
}
