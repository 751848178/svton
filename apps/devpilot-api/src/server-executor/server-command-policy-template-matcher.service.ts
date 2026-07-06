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

@Injectable()
export class ServerCommandPolicyTemplateMatcherService {
  constructor(
    private readonly repository: ServerCommandPolicyTemplateRepository,
  ) {}

  async loadMatchingTemplates(
    input: ServerExecutionInput,
  ): Promise<PolicyTemplateRecord[]> {
    const projectId = this.readMetadataString(input.metadata, "projectId");
    const environmentId = this.readMetadataString(
      input.metadata,
      "environmentId",
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

  private readMetadataString(
    metadata: ServerExecutionInput["metadata"],
    key: string,
  ): string | undefined {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
      return undefined;
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
