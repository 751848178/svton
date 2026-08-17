import { ConflictException } from "@nestjs/common";

export const PROJECT_ARCHIVED_READ_ONLY = "PROJECT_ARCHIVED_READ_ONLY";

export function archivedProjectWriteError() {
  return new ConflictException({
    code: PROJECT_ARCHIVED_READ_ONLY,
    message: "项目已归档，仅可查看历史记录",
    action: "如需继续接入仓库，请创建新的项目。",
  });
}

export function assertProjectWritable(project: {
  archivedAt?: Date | null;
  onboardingStatus?: string | null;
}) {
  if (project.archivedAt || project.onboardingStatus === "archived") {
    throw archivedProjectWriteError();
  }
}

export function isArchivedProjectWriteError(error: unknown) {
  if (!(error instanceof ConflictException)) return false;
  const response = error.getResponse();
  return typeof response === "object" && response !== null
    && "code" in response && response.code === PROJECT_ARCHIVED_READ_ONLY;
}
