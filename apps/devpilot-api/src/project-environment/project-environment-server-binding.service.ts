/**
 * Project-environment server-binding service.
 *
 * Owns the per-environment server role binding lifecycle: `listServers`,
 * `listTargets`, `getAccessScope`, `bindServer`, `unbindServer`. Each mutating
 * action writes an audit event.
 *
 * F445 hardening (AC-SET-017..024):
 * - `bindServer` validates providerKey/root (safe SSH root for ssh-v1), runs a
 *   real connectivity check via `ServerConnectionCapabilityService` before
 *   persisting (fail on unreachable, honest error), normalizes the legacy
 *   `deployment` role to `deploy`, and refuses to replace a binding that any
 *   DeploymentRun references (frozen guard).
 * - `unbindServer` soft-archives (status -> archived) instead of hard-deleting
 *   so historical runs stay traceable to the binding row (AC-SET-021).
 * - `listTargets` resolves the provider-matched CURRENT target with the same
 *   resolution the deploy path uses (AC-SET-023).
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { ServerConnectionCapabilityService } from '../server/server-connection-capability.service';
import { hashCanonicalReleaseValue } from '../release-delivery/release-canonical-hash.utils';
import { matchReleaseDeploymentTargetBindings } from '../release-delivery/release-deployment-target-match.utils';
import { isSafeReleaseDeploymentSshRoot } from '../release-delivery/release-deployment-ssh-target.utils';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { BindProjectEnvironmentServerDto } from './dto/project-environment.dto';
import { buildServerBindingAuditInput } from './project-environment-audit.utils';
import { toJsonValue as toJsonValueUtil } from './project-environment-helpers.utils';

const KNOWN_RELEASE_DEPLOYMENT_PROVIDER_KEYS = ['ssh-v1', 'local-filesystem-v1'];

type TargetBindingRow = {
  id: string;
  role: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: unknown;
  server: {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string | null;
    status: string;
  };
};

@Injectable()
export class ProjectEnvironmentServerBindingService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
    private readonly auditEventService: AuditEventService,
    private readonly capabilities: ServerConnectionCapabilityService,
  ) {}

  async listServers(teamId: string, environmentId: string) {
    const environment = await this.get(teamId, environmentId);
    return (this.repo.findProjectEnvironmentServers({
      where: { teamId, environmentId: environment.id, status: 'active' },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        server: { select: { id: true, name: true, host: true, status: true, services: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
      },
    }) as any);
  }

  async listTargets(teamId: string, environmentId: string) {
    const environment = await this.get(teamId, environmentId);
    const bindings = (await this.repo.findProjectEnvironmentServers({
      where: { teamId, environmentId: environment.id, status: 'active' },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        server: {
          select: {
            id: true, name: true, host: true, port: true, username: true, status: true,
          },
        },
      },
    })) as TargetBindingRow[];

    const providerKeys = uniqueProviderKeys(bindings);
    const providerKey = providerKeys.size === 1 ? [...providerKeys][0] : null;
    let currentTarget: Record<string, unknown> | null = null;
    if (providerKey) {
      const matches = matchReleaseDeploymentTargetBindings(bindings, providerKey);
      if (matches.length === 1) {
        const match = matches[0];
        const binding = match.binding;
        currentTarget = {
          bindingId: binding.id,
          serverId: binding.server.id,
          providerKey,
          targetRef: match.targetRef,
          root: match.root,
          server: {
            id: binding.server.id,
            name: binding.server.name,
            host: binding.server.host,
            status: binding.server.status,
          },
          sharedEnvironmentIds: bindingSharedEnvironmentIds(binding.metadata),
          versionHash: hashCanonicalReleaseValue({
            providerKey,
            targetRef: match.targetRef,
            root: match.root,
            bindingId: binding.id,
            bindingUpdatedAt: binding.updatedAt,
            serverId: binding.server.id,
            serverName: binding.server.name,
            serverHost: binding.server.host,
            serverStatus: binding.server.status,
          }),
        };
      }
    }

    return {
      providerKey,
      currentTarget,
      bindings: bindings.map((binding) => ({
        id: binding.id,
        role: binding.role,
        status: binding.status,
        createdAt: binding.createdAt,
        updatedAt: binding.updatedAt,
        providerKey: providerKeyOf(binding.metadata),
        sharedEnvironmentIds: bindingSharedEnvironmentIds(binding.metadata),
        metadata: record(binding.metadata),
        server: {
          id: binding.server.id,
          name: binding.server.name,
          host: binding.server.host,
          status: binding.server.status,
        },
      })),
    };
  }

  async getAccessScope(teamId: string, environmentId: string) {
    const environment = await this.get(teamId, environmentId);
    return { projectId: environment.projectId, environmentId: environment.id };
  }

  async bindServer(teamId: string, userId: string, environmentId: string, dto: BindProjectEnvironmentServerDto) {
    const environment = await this.get(teamId, environmentId);
    await this.assertServer(teamId, dto.serverId);

    const existing = await this.repo.findProjectEnvironmentServer({
      where: { teamId, environmentId: environment.id, serverId: dto.serverId },
      select: { id: true, metadata: true, status: true },
    });
    if (existing) {
      await this.assertNotFrozen(teamId, existing.id, dto.serverId, environment.id);
    }

    const previousMetadata = record(existing?.metadata);
    const previousDeployment = record(previousMetadata.releaseDeployment);
    const providerKey =
      dto.providerKey ??
      (typeof previousDeployment.providerKey === 'string' ? previousDeployment.providerKey : undefined);
    if (providerKey !== undefined) {
      if (!KNOWN_RELEASE_DEPLOYMENT_PROVIDER_KEYS.includes(providerKey)) {
        throw new BadRequestException(`不支持的部署 Provider：${providerKey}`);
      }
    }
    const root =
      dto.root ?? (typeof previousDeployment.root === 'string' ? previousDeployment.root : undefined);
    if (providerKey === 'ssh-v1') {
      if (!root) {
        throw new BadRequestException('ssh-v1 部署目标必须提供根目录（root）');
      }
      if (!isSafeReleaseDeploymentSshRoot(root)) {
        throw new BadRequestException('SSH 部署根目录不合法：仅允许绝对路径且不含 ..');
      }
    }

    const capability = await this.capabilities.verifyCapability(teamId, dto.serverId);
    if (!capability.networkReachable) {
      throw new ConflictException(
        `目标服务器不可达，绑定被拒绝：${capability.message}` +
          (capability.recommendation ? `；${capability.recommendation}` : ''),
      );
    }
    if (providerKey === 'ssh-v1' && !capability.authenticationVerified) {
      throw new ConflictException(
        `目标服务器 SSH 认证未通过，绑定被拒绝：${capability.message}` +
          (capability.recommendation ? `；${capability.recommendation}` : ''),
      );
    }

    const releaseDeployment: Record<string, unknown> = { providerKey };
    if (root !== undefined) releaseDeployment.root = root;
    if (dto.targetRef !== undefined) releaseDeployment.targetRef = dto.targetRef;
    const sharedEnvironmentIds = dto.sharedEnvironmentIds ?? bindingSharedEnvironmentIds(previousMetadata);
    if (sharedEnvironmentIds && sharedEnvironmentIds.length > 0) {
      await this.assertSharedEnvironmentScope(teamId, environment.projectId, sharedEnvironmentIds);
    }
    const metadata = toJsonValueUtil({
      ...previousMetadata,
      ...(dto.metadata ? record(dto.metadata) : {}),
      ...(providerKey !== undefined ? { releaseDeployment } : {}),
      ...(sharedEnvironmentIds !== undefined ? { sharedEnvironmentIds } : {}),
    });

    const role = normalizeBindingRole(dto.role);
    const binding = await this.repo.upsertProjectEnvironmentServer({
      where: { environmentId_serverId: { environmentId: environment.id, serverId: dto.serverId } },
      create: {
        teamId, projectId: environment.projectId, environmentId: environment.id, serverId: dto.serverId,
        role, metadata,
      },
      update: {
        projectId: environment.projectId, role, status: 'active', metadata,
      },
      include: {
        server: { select: { id: true, name: true, host: true, status: true, services: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
      },
    });

    await this.auditEventService.create(
      buildServerBindingAuditInput(teamId, userId, {
        projectId: environment.projectId, environmentId: environment.id, environmentName: environment.name,
        serverId: dto.serverId, serverName: binding.server.name, role,
        action: 'bind', status: 'completed',
      }) as any,
    );

    return binding;
  }

  async unbindServer(teamId: string, userId: string, environmentId: string, serverId: string) {
    const environment = await this.get(teamId, environmentId);
    const binding = await this.repo.findProjectEnvironmentServer({
      where: { teamId, environmentId: environment.id, serverId },
      select: { id: true, role: true, status: true, server: { select: { id: true, name: true } } },
    });

    if (!binding) throw new NotFoundException('环境服务器绑定不存在');
    if (binding.status === 'archived') return { success: true };

    await this.assertNotFrozen(teamId, binding.id, serverId, environment.id);
    await this.repo.updateProjectEnvironmentServer({
      where: { id: binding.id },
      data: { status: 'archived' },
    });
    await this.auditEventService.create(
      buildServerBindingAuditInput(teamId, userId, {
        projectId: environment.projectId, environmentId: environment.id, environmentName: environment.name,
        serverId, serverName: binding.server.name, role: binding.role,
        action: 'unbind', status: 'completed',
      }) as any,
    );

    return { success: true };
  }

  private async get(teamId: string, id: string) {
    const environment = await this.repo.findProjectEnvironment({ where: { id, teamId } });
    if (!environment) throw new NotFoundException('项目环境不存在');
    return environment;
  }

  private async assertServer(teamId: string, serverId: string) {
    const server = await this.repo.findServer({ where: { id: serverId, teamId }, select: { id: true } });
    if (!server) throw new NotFoundException('服务器不存在或不属于当前团队');
    return server;
  }

  /** 冻结守卫：任何 DeploymentRun 引用该绑定（params.deploymentInput.target.bindingId，
   *  或该环境+服务器上的发布运行）后，目标不可替换/解绑（AC-SET-018/021）。 */
  private async assertNotFrozen(teamId: string, bindingId: string, serverId: string, environmentId: string) {
    const referencing = await this.repo.findDeploymentRuns({
      where: {
        teamId,
        environmentId,
        params: { path: '$.deploymentInput', not: null },
        OR: [
          { serverId },
          { params: { path: '$.deploymentInput.target.bindingId', equals: bindingId } },
        ],
      },
      select: { id: true },
      take: 1,
    });
    if (referencing.length > 0) {
      throw new ConflictException('该部署目标已被部署运行引用，目标已冻结，禁止绑定、替换或解绑');
    }
  }

  /** 共享范围声明只接受同一项目内的环境（AC-SET-019，隔离为默认）。 */
  private async assertSharedEnvironmentScope(teamId: string, projectId: string, environmentIds: string[]) {
    const environments = await this.repo.findProjectEnvironments({
      where: { id: { in: environmentIds }, teamId, projectId },
      select: { id: true },
    });
    if (environments.length !== new Set(environmentIds).size) {
      throw new BadRequestException('共享范围包含不属于当前项目的环境，绑定被拒绝');
    }
  }
}

function normalizeBindingRole(role: BindProjectEnvironmentServerDto['role'] | null | undefined) {
  return role === 'deployment' ? 'deploy' : (role ?? null);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function providerKeyOf(metadata: unknown): string | null {
  const deployment = record(record(metadata).releaseDeployment);
  return typeof deployment.providerKey === 'string' && deployment.providerKey
    ? deployment.providerKey
    : null;
}

function bindingSharedEnvironmentIds(metadata: unknown): string[] {
  const value = record(metadata).sharedEnvironmentIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function uniqueProviderKeys(bindings: Array<{ metadata: unknown }>) {
  const keys = new Set<string>();
  for (const binding of bindings) {
    const key = providerKeyOf(binding.metadata);
    if (key) keys.add(key);
  }
  return keys;
}
