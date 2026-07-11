import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import {
  ProjectEnvironmentAuthRequest,
  ReadableProjectEnvironmentRecord,
} from "./project-environment-access-policy.types";

@Injectable()
export class ProjectEnvironmentReadAccessPolicyService {
  constructor(
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  assertCanReadEnvironment(
    req: ProjectEnvironmentAuthRequest,
    environmentId: string,
    projectId: string,
    scopedEnvironmentId: string,
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId: scopedEnvironmentId,
      category: "project_environment",
      action: "project_environment.read",
      targetType: "project_environment",
      targetId: environmentId,
      risk: "low",
    });
  }

  async filterReadableEnvironments<T extends ReadableProjectEnvironmentRecord>(
    req: ProjectEnvironmentAuthRequest,
    environments: T[],
  ) {
    const allowed = await Promise.all(
      environments.map(async (environment) => ({
        environment,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: environment.projectId,
          environmentId: environment.id,
          category: "project_environment",
          action: "project_environment.read",
          targetType: "project_environment",
          targetId: environment.id,
          risk: "low",
        }),
      })),
    );

    return allowed
      .filter((item) => item.allowed)
      .map((item) => item.environment);
  }
}
