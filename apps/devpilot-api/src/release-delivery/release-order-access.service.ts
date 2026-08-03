import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";

interface ReleaseOrderAccessInput {
  teamId: string;
  actorId: string;
  projectId: string;
}

@Injectable()
export class ReleaseOrderAccessService {
  constructor(private readonly access: ControlAccessPolicyService) {}

  assertRead(input: ReleaseOrderAccessInput) {
    return this.access.assertCanRead({
      ...input,
      category: "release",
      action: "project.release_order.read",
      targetType: "project",
      targetId: input.projectId,
      risk: "low",
    });
  }

  assertCreate(input: ReleaseOrderAccessInput) {
    return this.access.assertCanWrite({
      ...input,
      category: "release",
      action: "project.release_order.create",
      targetType: "project",
      targetId: input.projectId,
      risk: "medium",
    });
  }

  assertBuild(input: ReleaseOrderAccessInput) {
    return this.access.assertCanWrite({
      ...input,
      category: "release",
      action: "project.release_order.build",
      targetType: "project",
      targetId: input.projectId,
      risk: "high",
    });
  }

  assertDeployStaging(input: ReleaseOrderAccessInput) {
    return this.access.assertCanWrite({
      ...input,
      category: "release",
      action: "project.release_order.deploy_staging",
      targetType: "project",
      targetId: input.projectId,
      risk: "high",
    });
  }

  assertConfirmProduction(input: ReleaseOrderAccessInput) {
    return this.access.assertCanWrite({
      ...input,
      category: "release",
      action: "project.release_order.deploy_production",
      targetType: "project",
      targetId: input.projectId,
      risk: "high",
    });
  }

  assertManagePolicy(input: ReleaseOrderAccessInput) {
    return this.access.assertCanWrite({
      ...input,
      category: "release",
      action: "project.release_policy.revision.create",
      targetType: "project",
      targetId: input.projectId,
      risk: "medium",
    });
  }

  assertDeployEnvironment(input: ReleaseOrderAccessInput) {
    return this.access.assertCanWrite({
      ...input,
      category: "release",
      action: "project.environment_version.deploy",
      targetType: "project",
      targetId: input.projectId,
      risk: "high",
    });
  }
}
