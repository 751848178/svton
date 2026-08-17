import type { Prisma } from "@prisma/client";
import type { RepositoryAnalysisAuditService } from "./repository-analysis-audit.service";

export interface VerifiedRepositoryConnectionAudit {
  id: string;
  provider: string;
  credentialSource: string;
}

export function recordVerifiedRepositoryConnection(
  audit: RepositoryAnalysisAuditService,
  tx: Prisma.TransactionClient,
  input: {
    teamId: string;
    userId: string;
    projectId: string;
    branch: string;
    commitSha: string;
    connection: VerifiedRepositoryConnectionAudit;
  },
) {
  return audit.record({
    teamId: input.teamId,
    userId: input.userId,
    projectId: input.projectId,
    action: "repository.connect",
    targetType: "repository_connection",
    targetId: input.connection.id,
    summary: `已验证只读仓库 ${input.branch}@${input.commitSha.slice(0, 12)}`,
    metadata: {
      provider: input.connection.provider,
      branch: input.branch,
      commitSha: input.commitSha,
      credentialSource: input.connection.credentialSource,
    },
  }, tx);
}
