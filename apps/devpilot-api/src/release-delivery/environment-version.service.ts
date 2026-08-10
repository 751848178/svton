import { Injectable } from "@nestjs/common";
import {
  SiteProbePort,
  SiteRouteActivationPort,
} from "../site/site-route-activation.types";
import { SiteRouteSwitchPort } from "../site/site-route-switch.port";
import { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { runEnvironmentDeployment } from "./environment-version-deployment";
import { executeEnvironmentVersion } from "./environment-version-execution";
import type { EnvironmentVersionExecuteInput } from "./environment-version-execution.types";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { currentEnvironmentVersionId } from "./environment-version-read.utils";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import { ReleaseStagingWorkloadService } from "./release-staging-workload.service";

@Injectable()
export class EnvironmentVersionService {
  constructor(
    private readonly repository: EnvironmentVersionRepository,
    private readonly completion: EnvironmentVersionCompletionRepository,
    private readonly readRepository: EnvironmentVersionReadRepository,
    private readonly policy: EnvironmentVersionPolicyService,
    private readonly executor: ReleaseStagingExecutorPort,
    private readonly productionGates: EnvironmentVersionProductionGateService,
    private readonly gateEvidence: EnvironmentVersionGateEvidenceRepository,
    private readonly inputs: ReleaseDeploymentInputService,
    private readonly stagingWorkloads: ReleaseStagingWorkloadService,
    private readonly productionWorkloads: ReleaseProductionWorkloadService,
    private readonly routeActivation: SiteRouteActivationPort,
    private readonly routeSwitch: SiteRouteSwitchPort,
    private readonly siteProbe: SiteProbePort,
  ) {}

  async list(teamId: string, projectId: string) {
    const [environments, candidates] = await Promise.all([
      this.readRepository.environments(teamId, projectId),
      this.readRepository.candidates(teamId, projectId),
    ]);
    const project = { id: projectId, teamId };
    return {
      environments: environments.map((environment) => ({
        ...environment,
        currentEnvironmentVersionId: currentEnvironmentVersionId(
          project,
          environment,
        ),
      })),
      candidates,
    };
  }

  execute(input: EnvironmentVersionExecuteInput) {
    return executeEnvironmentVersion(
      {
        repository: this.repository,
        policy: this.policy,
        executor: this.executor,
        productionGates: this.productionGates,
        inputs: this.inputs,
        stagingWorkloads: this.stagingWorkloads,
        productionWorkloads: this.productionWorkloads,
        run: (context) =>
          runEnvironmentDeployment(
            {
              executor: this.executor,
              gateEvidence: this.gateEvidence,
              completion: this.completion,
              productionGates: this.productionGates,
              routeActivation: this.routeActivation,
              routeSwitch: this.routeSwitch,
              siteProbe: this.siteProbe,
            },
            context,
          ),
      },
      input,
    );
  }
}
