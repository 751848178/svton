import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { isCommandPolicyPatternMatch } from "./server-command-policy-pattern.utils";
import {
  matchesStringList,
  readStringList,
} from "./server-command-policy-string-list.utils";
import { ServerCommandPolicyTemplateRepository } from "./server-command-policy-template.repository";
import {
  PolicyTemplatePatternField,
  PolicyTemplateRecord,
} from "./server-command-policy.types";
import { ServerExecutionInput } from "./server-executor.types";
import { readExecutionScopeFromMetadata } from "./server-execution-scope";

@Injectable()
export class ServerCommandPolicyTemplateMatcherService {
  constructor(
    private readonly repository: ServerCommandPolicyTemplateRepository,
  ) {}

  // 读取候选模板：team-global 基线 + 项目级 + 环境级。作用域来自统一 reader
  // （顶层 projectId/environmentId，回退 sourceMetadata.*，兼容旧 release-stage 数据）。
  // 租户隔离由 repository.findEnabledForScope 的 teamId 硬等式保证，不会跨租户泄漏。
  async loadMatchingTemplates(
    input: ServerExecutionInput,
  ): Promise<PolicyTemplateRecord[]> {
    const { projectId, environmentId } = readExecutionScopeFromMetadata(
      input.metadata,
    );
    const scope: Prisma.ServerCommandPolicyTemplateWhereInput[] = [
      { projectId: null, environmentId: null },
    ];

    if (projectId) scope.push({ projectId, environmentId: null });
    if (environmentId) scope.push({ environmentId });

    const templates = await this.repository.findEnabledForScope(
      input.teamId,
      scope,
    );
    return templates.filter(
      (template) =>
        matchesStringList(template.adapterKeys, input.adapterKey) &&
        matchesStringList(template.operationKeys, input.operationKey),
    );
  }

  findPatternMatch(
    templates: PolicyTemplateRecord[],
    field: PolicyTemplatePatternField,
    command: string,
  ): { template: PolicyTemplateRecord; pattern: string } | undefined {
    for (const template of templates) {
      for (const pattern of readStringList(template[field])) {
        if (isCommandPolicyPatternMatch(pattern, command)) {
          return { template, pattern };
        }
      }
    }
    return undefined;
  }
}
