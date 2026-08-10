import { ConflictException, Injectable } from "@nestjs/common";
import { CryptoService } from "../common/crypto/crypto.service";
import { interpolateEnvTemplate } from "../deployment/deployment-env-injection.utils";
import { PrismaService } from "../prisma/prisma.service";
import { loadReleaseDeploymentInputState } from "./release-deployment-input-state.repository";
import {
  buildReleaseDeploymentInputSnapshot,
  selectReleaseDeploymentTarget,
} from "./release-deployment-input-snapshot.utils";
import type { PreparedReleaseDeploymentInput } from "./release-deployment-input.types";
import { assertSafeReleaseWorkloadEnvironment } from "./release-workload-environment-policy";
import {
  effectiveResourceBindings,
  environmentKeysFromTemplate,
  mapResourceEnvironment,
  secretTargetEnvKey,
} from "../project-environment/environment-variable-binding.utils";
import { assertReleaseDeploymentEnvironmentOwnership } from "./release-deployment-environment-ownership.policy";

@Injectable()
export class ReleaseDeploymentInputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async prepare(input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    providerKey: string;
    configRevisionId?: string;
    label?: string;
  }): Promise<PreparedReleaseDeploymentInput> {
    const state = await loadReleaseDeploymentInputState(this.prisma, input);
    const target = selectReleaseDeploymentTarget(state, input.providerKey);
    const runtimeEnvironment = this.runtimeEnvironment(state);
    assertSafeReleaseWorkloadEnvironment(runtimeEnvironment);
    const { snapshot, binding, root } = buildReleaseDeploymentInputSnapshot(
      state,
      input.providerKey,
      Object.keys(runtimeEnvironment),
      target,
    );
    return {
      snapshot,
      runtimeEnvironment,
      targetConnection:
        input.providerKey === "ssh-v1"
          ? {
              host: binding.server.host,
              port: binding.server.port,
              username: binding.server.username,
              authType: binding.server.authType,
              credential: this.decryptGcm(
                binding.server.credentials,
                "部署目标凭据",
              ),
              root,
            }
          : undefined,
    };
  }

  private runtimeEnvironment(
    state: Awaited<ReturnType<typeof loadReleaseDeploymentInputState>>,
  ) {
    const output: Record<string, string> = {};
    assertReleaseDeploymentEnvironmentOwnership(state);
    for (const resource of state.resources) {
      if (resource.status !== "active") {
        throw new ConflictException(`资源 ${resource.id} 当前不可用于部署`);
      }
      if (!resource.runtime?.envTemplate) continue;
      const credentials = resource.runtime.credentials
        ? this.parseJson(
            this.decryptGcm(
              resource.runtime.credentials,
              `资源 ${resource.id} 凭据`,
            ),
            resource.id,
          )
        : {};
      const delivery = record(resource.runtime.delivery);
      const rendered = interpolateEnvTemplate(resource.runtime.envTemplate, {
        ...delivery,
        ...credentials,
      });
      const bindings = effectiveResourceBindings(
        resource,
        environmentKeysFromTemplate(resource.runtime.envTemplate),
      );
      Object.assign(output, mapResourceEnvironment(rendered, bindings));
    }
    Object.assign(output, plainEnvironment(state.revision.plainVariables));
    const secretKeys = new Set<string>();
    for (const secret of state.secrets) {
      const key = secretTargetEnvKey(secret);
      if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        throw new ConflictException(`Secret ${secret.id} 无法映射为环境变量`);
      }
      if (secretKeys.has(key)) {
        throw new ConflictException(`Secret 环境变量 ${key} 存在重复映射`);
      }
      secretKeys.add(key);
      output[key] = this.decryptCbc(secret.value, `Secret ${secret.id}`);
    }
    return output;
  }

  private decryptGcm(value: string, label: string) {
    try {
      return this.crypto.decryptGcm(value);
    } catch {
      throw new ConflictException(`${label} 无法解析，请更新部署快照`);
    }
  }

  private decryptCbc(value: string, label: string) {
    try {
      return this.crypto.decryptCbc(value);
    } catch {
      throw new ConflictException(`${label} 无法解析，请更新部署快照`);
    }
  }

  private parseJson(value: string, resourceId: string) {
    try {
      return record(JSON.parse(value));
    } catch {
      throw new ConflictException(`资源 ${resourceId} 凭据格式无效`);
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function plainEnvironment(value: unknown) {
  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record(value))) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || typeof entry !== "string") {
      throw new ConflictException(`普通变量 ${key} 不符合部署输入约束`);
    }
    output[key] = entry;
  }
  return output;
}
