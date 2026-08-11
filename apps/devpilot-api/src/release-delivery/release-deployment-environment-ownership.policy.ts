import { ConflictException } from "@nestjs/common";
import {
  environmentKeysFromTemplate,
  resourceVariableOwners,
  secretTargetEnvKey,
} from "../project-environment/environment-variable-binding.utils";
import {
  environmentVariableCollisionMessage,
  findEnvironmentVariableCollisions,
  type EnvironmentVariableOwner,
} from "../project-environment/environment-variable-ownership.model";
import type { ReleaseDeploymentInputState } from "./release-deployment-input.types";

export function assertReleaseDeploymentEnvironmentOwnership(
  state: ReleaseDeploymentInputState,
) {
  const owners: EnvironmentVariableOwner[] = [];
  for (const resource of state.resources) {
    if (!resource.componentKey) {
      throw new ConflictException(`资源 ${resource.id} 未绑定真实工作负载组件`);
    }
    const sourceKeys = environmentKeysFromTemplate(resource.runtime?.envTemplate);
    const unknown = resource.envBindings?.find((binding) =>
      !sourceKeys.includes(binding.sourceKey));
    if (unknown) {
      throw new ConflictException(
        `资源 ${resource.id} 的来源变量 ${unknown.sourceKey} 已不属于资源模板`,
      );
    }
    owners.push(...resourceVariableOwners(resource, sourceKeys));
  }
  owners.push(...plainVariableKeys(state.revision.plainVariables).map((key) => ({
    key, source: "plain" as const, reference: key, scope: "global",
  })));
  owners.push(...state.secrets.map((secret) => ({
    key: secretTargetEnvKey(secret),
    source: "secret" as const,
    reference: secret.id, scope: "global",
  })));
  const collision = findEnvironmentVariableCollisions(owners)[0];
  if (collision) {
    throw new ConflictException(environmentVariableCollisionMessage(collision));
  }
}

function plainVariableKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value);
}
