import { ConflictException } from "@nestjs/common";

export function activeRepositoryAnalysisArchiveError(runId: string) {
  return new ConflictException({
    code: "PROJECT_ARCHIVE_REPOSITORY_ANALYSIS_ACTIVE",
    message: "项目仍有仓库解析任务正在运行，暂时不能归档",
    action: "请等待解析完成，或先取消解析后再归档项目。",
    runId,
  });
}

export function activeProjectFinalizationArchiveError(finalizationId: string) {
  return new ConflictException({
    code: "PROJECT_ARCHIVE_FINALIZATION_ACTIVE",
    message: "项目接入确认仍在执行，暂时不能归档",
    action: "请等待接入确认完成后再归档项目。",
    finalizationId,
  });
}
