import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";

interface IntakeAccessInput {
  teamId: string;
  actorId: string;
  projectId?: string;
}

@Injectable()
export class ProjectIntakeAccessService {
  constructor(private readonly access: ControlAccessPolicyService) {}

  assertCreate(input: IntakeAccessInput) {
    return this.access.assertCanWrite({
      ...input,
      category: "project",
      action: "project.intake.create",
      targetType: "project",
      risk: "medium",
    });
  }

  assertRead(input: IntakeAccessInput & { projectId: string }) {
    return this.access.assertCanRead({
      ...input,
      category: "project",
      action: "project.intake.read",
      targetType: "project",
      targetId: input.projectId,
      risk: "low",
    });
  }

  assertWrite(
    input: IntakeAccessInput & { projectId: string },
    action: string,
  ) {
    return this.access.assertCanWrite({
      ...input,
      category: "project",
      action,
      targetType: "project",
      targetId: input.projectId,
      risk: "medium",
    });
  }
}
