import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import { ReleaseBuildRuntimeSupervisorService } from "./release-build-runtime-supervisor.service";
import { presentBuild } from "./release-build.presenter";

@Injectable()
export class ReleaseBuildCancellationService {
  constructor(
    private readonly builds: ReleaseBuildRepository,
    private readonly results: ReleaseBuildResultRepository,
    private readonly supervisor: ReleaseBuildRuntimeSupervisorService,
  ) {}

  async cancel(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
  }) {
    const run = await this.builds.get(
      input.teamId,
      input.projectId,
      input.releaseOrderId,
      input.buildRunId,
    );
    if (!run) throw new NotFoundException("BuildRun 不存在或不属于当前发布单");
    if (run.status === "canceled") return presentBuild(run);
    if (run.status !== "running" && run.status !== "queued") {
      throw new ConflictException("BuildRun 已结束，不能取消");
    }
    if (await this.supervisor.cancel(run.id)) {
      const canceled = await this.builds.get(
        input.teamId,
        input.projectId,
        input.releaseOrderId,
        input.buildRunId,
      );
      if (!canceled) {
        throw new NotFoundException("BuildRun 取消后不可读取");
      }
      return presentBuild(canceled);
    }
    return presentBuild(await this.results.cancelActive(run.id));
  }
}
