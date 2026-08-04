import type { RepositoryConnection } from "@prisma/client";
import { identityConflict, identityUnavailable } from "./repository-identity.errors";
import type {
  RepositoryIdentityCandidate,
  RepositoryIdentityState,
} from "./repository-identity.types";
import { normalizeRepositoryIdentity } from "./repository-identity.utils";

export function assertIdentityCandidate(
  identity: RepositoryIdentityState,
  candidate: RepositoryIdentityCandidate,
  allowBranchChange = false,
): void {
  if (!identity.currentRevision) {
    throw identityUnavailable(
      "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED",
      "READY 项目缺少可验证的仓库身份修订",
      "请先完成仓库身份迁移，再修改连接。",
    );
  }
  if (identity.currentRevision.identityId !== identity.id
    || identity.currentRevision.projectId !== identity.projectId) {
    throw identityConflict(
      "PROJECT_REPOSITORY_REVISION_OWNERSHIP_DRIFT",
      "仓库身份的当前修订不属于该项目",
      "请停止操作并修复仓库身份修订关系。",
    );
  }
  const normalized = normalizeRepositoryIdentity(candidate.repositoryUrl);
  if (!normalized
    || normalized.canonicalKey !== identity.canonicalKey
    || normalized.canonicalUrl !== identity.canonicalUrl) {
    throw identityConflict(
      "PROJECT_REPOSITORY_IDENTITY_LOCKED",
      "仓库地址与项目已锁定的规范身份不一致",
      "请保留当前仓库；如需接入其他仓库，请创建新项目。",
    );
  }
  if (normalized.provider !== identity.provider
    || candidate.provider !== normalized.provider
    || candidate.provider !== identity.provider) {
    throw identityConflict(
      "PROJECT_REPOSITORY_PROVIDER_DRIFT",
      "仓库提供商与项目已锁定的规范身份不一致",
      "请使用与规范仓库匹配的凭据和连接方式。",
    );
  }
  if (!allowBranchChange && candidate.branch !== identity.currentRevision.defaultBranch) {
    throw identityConflict(
      "PROJECT_REPOSITORY_BRANCH_REVISION_REQUIRED",
      "默认分支只能通过分支修订流程调整",
      "请使用“修订默认分支”并填写原因。",
    );
  }
}

export function assertStoredConnection(
  identity: RepositoryIdentityState,
  connection: Pick<
    RepositoryConnection,
    "repositoryUrl" | "provider" | "defaultBranch" | "selectedBranch" | "status"
  > | null,
): void {
  if (!connection || connection.status !== "connected" || !identity.currentRevision) {
    throw identityUnavailable(
      "PROJECT_REPOSITORY_IDENTITY_NOT_READY",
      "项目规范仓库身份尚未准备完成",
      "请完成仓库接入或处理身份迁移后重试。",
    );
  }
  if (!isStoredConnectionAligned(identity, connection)) {
    throw identityConflict(
      "PROJECT_REPOSITORY_CONNECTION_DRIFT",
      "仓库连接已偏离锁定身份或生效分支",
      "请先重新连接锁定仓库，再发起解析或构建。",
    );
  }
}

export function isStoredConnectionAligned(
  identity: RepositoryIdentityState | null,
  connection: Pick<
    RepositoryConnection,
    "repositoryUrl" | "provider" | "defaultBranch" | "selectedBranch" | "status"
  > | null,
): boolean {
  if (!identity?.currentRevision || !connection || connection.status !== "connected") {
    return false;
  }
  const normalized = normalizeRepositoryIdentity(connection.repositoryUrl);
  return Boolean(
    normalized
    && normalized.canonicalKey === identity.canonicalKey
    && normalized.canonicalUrl === identity.canonicalUrl
    && normalized.provider === identity.provider
    && connection.provider === identity.provider
    && connection.defaultBranch === identity.currentRevision.defaultBranch
    && connection.selectedBranch === identity.currentRevision.defaultBranch
    && identity.currentRevision.identityId === identity.id
    && identity.currentRevision.projectId === identity.projectId,
  );
}
