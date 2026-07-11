import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import {
  EnvironmentCopyScope,
  ProjectEnvironmentAuthRequest,
} from "./project-environment-access-policy.types";
import { ProjectEnvironmentReadAccessPolicyService } from "./project-environment-read-access-policy.service";

@Injectable()
export class ProjectEnvironmentCopyAccessPolicyService {
  constructor(
    private readonly accessPolicyService: ControlAccessPolicyService,
    private readonly readAccessPolicy: ProjectEnvironmentReadAccessPolicyService,
  ) {}

  async assertCanApplySyncSuggestions(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentCopyScope,
    dryRun?: boolean,
  ) {
    await this.readAccessPolicy.assertCanReadEnvironment(
      req,
      scope.sourceEnvironmentId,
      scope.projectId,
      scope.sourceEnvironmentId,
    );
    return this.writeTarget(
      req,
      scope,
      "project_environment.sync_suggestions.apply",
      dryRun,
    );
  }

  assertCanCopySites(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentCopyScope,
    dryRun?: boolean,
  ) {
    return this.copy(
      req,
      scope,
      "project_environment.sites.copy.read_source",
      "project_environment.sites.copy",
      dryRun,
    );
  }

  assertCanCopyCdnConfigs(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentCopyScope,
    dryRun?: boolean,
  ) {
    return this.copy(
      req,
      scope,
      "project_environment.cdn_configs.copy.read_source",
      "project_environment.cdn_configs.copy",
      dryRun,
    );
  }

  assertCanCopyResources(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentCopyScope,
    dryRun?: boolean,
  ) {
    return this.copy(
      req,
      scope,
      "project_environment.resources.copy.read_source",
      "project_environment.resources.copy",
      dryRun,
    );
  }

  private async copy(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentCopyScope,
    readAction: string,
    writeAction: string,
    dryRun?: boolean,
  ) {
    await this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.sourceEnvironmentId,
      category: "project_environment",
      action: readAction,
      targetType: "project_environment",
      targetId: scope.sourceEnvironmentId,
      risk: "low",
    });
    return this.writeTarget(req, scope, writeAction, dryRun);
  }

  private writeTarget(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentCopyScope,
    action: string,
    dryRun?: boolean,
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.targetEnvironmentId,
      category: "project_environment",
      action,
      targetType: "project_environment",
      targetId: scope.targetEnvironmentId,
      risk: dryRun === false ? "medium" : "low",
    });
  }
}
