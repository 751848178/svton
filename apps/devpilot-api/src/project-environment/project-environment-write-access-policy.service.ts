import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import {
  EnvironmentScope,
  ProjectEnvironmentAuthRequest,
} from "./project-environment-access-policy.types";

type Risk = "low" | "medium" | "high";

@Injectable()
export class ProjectEnvironmentWriteAccessPolicyService {
  constructor(
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  assertCanCreate(req: ProjectEnvironmentAuthRequest, projectId: string) {
    return this.write(req, {
      projectId,
      category: "project_environment",
      action: "project_environment.create",
      targetType: "project_environment",
      risk: "medium",
    });
  }

  assertCanBulkBindResources(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentScope,
    dryRun?: boolean,
  ) {
    return this.writeEnvironment(
      req,
      scope.projectId,
      scope.environmentId,
      "project_environment.resources.bulk_bind",
      dryRun,
    );
  }

  assertCanUpdate(
    req: ProjectEnvironmentAuthRequest,
    id: string,
    scope: EnvironmentScope,
  ) {
    return this.write(
      req,
      this.environmentParams(scope, "project_environment.update", id, "medium"),
    );
  }

  assertCanArchive(
    req: ProjectEnvironmentAuthRequest,
    id: string,
    scope: EnvironmentScope,
  ) {
    return this.write(
      req,
      this.environmentParams(scope, "project_environment.archive", id, "high"),
    );
  }

  assertCanBindServer(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentScope,
    serverId: string,
  ) {
    return this.write(
      req,
      this.serverParams(scope, "project_environment.server.bind", serverId),
    );
  }

  assertCanUnbindServer(
    req: ProjectEnvironmentAuthRequest,
    scope: EnvironmentScope,
    serverId: string,
  ) {
    return this.write(
      req,
      this.serverParams(scope, "project_environment.server.unbind", serverId),
    );
  }

  assertCanSyncFromProject(
    req: ProjectEnvironmentAuthRequest,
    projectId: string,
  ) {
    return this.write(req, {
      projectId,
      category: "project_environment",
      action: "project_environment.sync_from_project",
      targetType: "project",
      targetId: projectId,
      risk: "medium",
    });
  }

  private writeEnvironment(
    req: ProjectEnvironmentAuthRequest,
    projectId: string,
    environmentId: string,
    action: string,
    dryRun?: boolean,
  ) {
    return this.write(
      req,
      this.environmentParams(
        { projectId, environmentId },
        action,
        environmentId,
        dryRun === false ? "medium" : "low",
      ),
    );
  }

  private environmentParams(
    scope: EnvironmentScope,
    action: string,
    targetId: string,
    risk: Risk,
  ) {
    return {
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: "project_environment",
      action,
      targetType: "project_environment",
      targetId,
      risk,
    };
  }

  private serverParams(
    scope: EnvironmentScope,
    action: string,
    serverId: string,
  ) {
    return {
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: "project_environment",
      action,
      targetType: "project_environment_server",
      targetId: serverId,
      risk: "medium" as const,
    };
  }

  private write(
    req: ProjectEnvironmentAuthRequest,
    params: {
      projectId: string;
      environmentId?: string;
      category: string;
      action: string;
      targetType: string;
      targetId?: string;
      risk: Risk;
    },
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      ...params,
    });
  }
}
