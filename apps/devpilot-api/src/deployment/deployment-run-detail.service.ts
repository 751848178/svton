import { Injectable, NotFoundException } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import { DeploymentRunDetailRepository } from "./deployment-run-detail.repository";

interface DeploymentRunReadInput {
  teamId: string;
  actorId: string;
  runId: string;
  projectId?: string;
}

/** 读取单条部署运行并执行项目/环境访问策略。 */
@Injectable()
export class DeploymentRunDetailService {
  constructor(
    private readonly repository: DeploymentRunDetailRepository,
    private readonly accessPolicy: ControlAccessPolicyService,
  ) {}

  async get(input: DeploymentRunReadInput) {
    const run = await this.repository.findById(
      input.teamId,
      input.runId,
      input.projectId,
    );
    if (!run) throw new NotFoundException("部署运行不存在");
    const readable = await this.accessPolicy.canRead({
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: run.projectId,
      environmentId: run.environmentId,
      category: "deployment",
      action: "deployment_run.read",
      targetType: "deployment_run",
      targetId: run.id,
      risk: "low",
    });
    if (!readable) throw new NotFoundException("部署运行不存在");
    return run;
  }
}
