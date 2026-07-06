import { Injectable } from "@nestjs/common";
import {
  CreateServerCommandPolicyTemplateDto,
  ListServerCommandPolicyTemplatesQueryDto,
  UpdateServerCommandPolicyTemplateDto,
} from "./dto/server-command-policy-template.dto";
import { DANGEROUS_COMMAND_PATTERNS } from "./server-command-policy-dangerous.constants";
import { BUILT_IN_COMMAND_RULES } from "./server-command-policy-rules.constants";
import { ServerCommandPolicyTemplateMatcherService } from "./server-command-policy-template-matcher.service";
import { ServerCommandPolicyTemplateService } from "./server-command-policy-template.service";
import { PolicyTemplateRecord } from "./server-command-policy.types";
import {
  ServerCommandPolicyDecision,
  ServerCommandPolicyResult,
  ServerCommandStep,
  ServerExecutionInput,
} from "./server-executor.types";

@Injectable()
export class ServerCommandPolicyService {
  private readonly policyKey = "server-command-policy:built-in-baseline:v1";

  constructor(
    private readonly templates: ServerCommandPolicyTemplateService,
    private readonly templateMatcher: ServerCommandPolicyTemplateMatcherService,
  ) {}

  listTemplates(
    teamId: string,
    query: ListServerCommandPolicyTemplatesQueryDto,
  ) {
    return this.templates.listTemplates(teamId, query);
  }

  createTemplate(
    teamId: string,
    userId: string,
    dto: CreateServerCommandPolicyTemplateDto,
  ) {
    return this.templates.createTemplate(teamId, userId, dto);
  }

  getTemplateAccessScope(teamId: string, id: string) {
    return this.templates.getTemplateAccessScope(teamId, id);
  }

  updateTemplate(
    teamId: string,
    id: string,
    dto: UpdateServerCommandPolicyTemplateDto,
  ) {
    return this.templates.updateTemplate(teamId, id, dto);
  }

  deleteTemplate(teamId: string, id: string) {
    return this.templates.deleteTemplate(teamId, id);
  }

  async evaluate(
    input: ServerExecutionInput,
  ): Promise<ServerCommandPolicyResult> {
    const templates = await this.templateMatcher.loadMatchingTemplates(input);
    const decisions = input.steps.map((step) =>
      this.evaluateStep(input, step, templates),
    );
    const blocked = decisions.filter(
      (decision) => decision.status === "blocked",
    );
    const templateKeys = templates.map((template) => template.id);

    return {
      status: blocked.length > 0 ? "blocked" : "passed",
      policyKey: templateKeys.length
        ? `${this.policyKey}+templates:${templateKeys.join(",")}`
        : this.policyKey,
      mode: templateKeys.length
        ? "built_in_with_templates"
        : "built_in_baseline",
      templateKeys,
      decisions,
      warnings: blocked.map(
        (decision) => `${decision.label}: ${decision.reason}`,
      ),
      blockedReasons: blocked.map((decision) => decision.reason),
    };
  }

  private evaluateStep(
    input: ServerExecutionInput,
    step: ServerCommandStep,
    templates: PolicyTemplateRecord[],
  ): ServerCommandPolicyDecision {
    if (!step.command) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: "allowed",
        ruleKey: "empty-command",
        reason: step.required
          ? "必填命令为空，将由执行器可执行性检查处理"
          : "非必填空命令",
      };
    }

    const dangerous = DANGEROUS_COMMAND_PATTERNS.find((item) =>
      item.pattern.test(step.command),
    );
    if (dangerous) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: "blocked",
        ruleKey: dangerous.key,
        reason: dangerous.reason,
      };
    }

    const blockedByTemplate = this.templateMatcher.findPatternMatch(
      templates,
      "blockedPatterns",
      step.command,
    );
    if (blockedByTemplate) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: "blocked",
        ruleKey: `template-block:${blockedByTemplate.template.id}`,
        reason: `策略模板「${blockedByTemplate.template.name}」阻断命令模式: ${blockedByTemplate.pattern}`,
      };
    }

    const matched = BUILT_IN_COMMAND_RULES.find(
      (rule) =>
        rule.adapters.includes(input.adapterKey) &&
        (!rule.operations || rule.operations.includes(input.operationKey)) &&
        rule.pattern.test(step.command),
    );
    if (matched) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: "allowed",
        ruleKey: matched.key,
        reason: matched.description,
      };
    }

    const allowedByTemplate = this.templateMatcher.findPatternMatch(
      templates,
      "allowedPatterns",
      step.command,
    );
    if (allowedByTemplate) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: "allowed",
        ruleKey: `template-allow:${allowedByTemplate.template.id}`,
        reason: `策略模板「${allowedByTemplate.template.name}」允许命令模式: ${allowedByTemplate.pattern}`,
      };
    }

    return {
      stepKey: step.key,
      label: step.label,
      command: step.command,
      status: "blocked",
      ruleKey: "no-allowlist-match",
      reason: `命令未匹配 Server executor 白名单: ${input.adapterKey}/${input.operationKey}/${step.key}`,
    };
  }
}
