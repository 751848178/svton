import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReleaseBuildRecoveryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  recoverInterrupted() {
    return this.prisma.buildRun.updateMany({
      where: { status: { in: ["queued", "running"] } },
      data: {
        status: "failed",
        errorCode: "BUILD_EXECUTOR_RESTARTED",
        errorMessage: "构建执行器重启，原运行已终止",
        gateSummary: {
          build: { status: "failed" },
          action: "请重新创建 BuildRun。",
        },
        finishedAt: new Date(),
      },
    });
  }
}
