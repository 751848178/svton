/**
 * Shared connection / query credential + auth-adapter helpers.
 *
 * Extracted from `ResourceControlService` so the connection-probe and
 * resource-query focused services can share one credential-resolution /
 * auth-adapter / probe-action surface without duplicating it. Behavior
 * preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ResourceControlRepository } from './resource-control.repository';
import { DefaultCredentialResolver, ResolvedCredentialRef } from './credentials/credential-resolver';
import {
  getActionDefinition,
  ResourceActionDefinition,
} from './actions/resource-actions';
import {
  isDirectQueryCredentialType,
  requiresDirectQueryCredential,
} from './resource-control-query-type.utils';
import { resolveQueryCredentialId } from './resource-control-binding.utils';

type ManagedResourceForConnection = {
  id: string; sourceType: string; provider: string; kind: string; name: string;
  externalId: string; status: string; endpoint: string | null;
  projectId: string | null; environmentId: string | null; serverId: string | null;
  credentialId: string | null; config: unknown; metadata: unknown;
};

@Injectable()
export class ResourceControlConnectionSharedService {
  constructor(
    private readonly repo: ResourceControlRepository,
    private readonly credentialResolver: DefaultCredentialResolver,
  ) {}

  buildConnectionProbeAction(resource: {
    sourceType: string; provider: string; kind: string;
  }): ResourceActionDefinition {
    const knownActionKey =
      resource.provider === 'docker' && resource.kind === 'docker_container'
        ? 'docker.container.inspect'
        : resource.kind === 'mysql' || resource.kind === 'database'
          ? 'mysql.connection.test'
          : resource.kind === 'redis'
            ? 'redis.connection.ping'
            : resource.provider === 'aliyun-sls'
              ? 'sls.logstores.list'
              : resource.provider === 'tencent-cos'
                ? 'cos.objects.list'
                : 'resource.connection.probe';
    const knownAction = getActionDefinition(knownActionKey);
    if (knownAction) return knownAction;
    return {
      key: knownActionKey, name: '连接探测', description: '生成资源连接和授权探测计划',
      providers: [resource.provider], kinds: [resource.kind], sourceTypes: [resource.sourceType],
      executorKey: resource.sourceType === 'server' ? 'server-executor'
        : resource.sourceType === 'cloud' ? 'cloud-sdk' : 'direct-db-adapter',
      adapterKey: 'resource-connection-plan', mode: 'read', risk: 'low',
      dryRunOnly: true, requiresConfirmation: false,
    };
  }

  resolveConnectionExecutionShape(
    resource: { sourceType: string; provider: string }, credential: ResolvedCredentialRef,
  ) {
    if (resource.sourceType === 'server' && credential.transport === 'ssh') {
      return { executorKey: 'server-executor', adapterKey: 'resource-connection-plan' };
    }
    if (resource.sourceType === 'cloud') {
      return { executorKey: 'cloud-sdk', adapterKey: `${resource.provider}-connection-plan` };
    }
    return { executorKey: 'direct-db-adapter', adapterKey: 'direct-db-connection-plan' };
  }

  resolveAuthAdapterKey(resource: { sourceType: string; provider: string }, credential: ResolvedCredentialRef) {
    if (credential.transport === 'direct_db') {
      return credential.credentialType === 'db_redis_readonly'
        ? 'redis-readonly-team-credential' : 'mysql-readonly-team-credential';
    }
    if (credential.source === 'server') return 'server-ssh';
    if (credential.source === 'team_credential') return `${resource.provider}-team-credential`;
    if (resource.sourceType === 'cloud') return `${resource.provider}-unbound-credential`;
    return 'direct-db-credential';
  }

  async resolveResourceQueryCredential(
    teamId: string, resource: ManagedResourceForConnection, action: ResourceActionDefinition,
  ): Promise<ResolvedCredentialRef> {
    if (requiresDirectQueryCredential(resource)) {
      const queryCredentialId = resolveQueryCredentialId(resource as { config: Prisma.JsonValue });
      const directCredential = queryCredentialId
        ? await this.resolveDirectQueryCredential(teamId, resource, queryCredentialId, action)
        : resource.credentialId
          ? await this.resolveDirectQueryCredential(teamId, resource, resource.credentialId, action, true)
          : null;
      if (directCredential) return directCredential;
    }
    return this.credentialResolver.resolve(teamId, resource, action);
  }

  resolveQueryRunCredentialId(resource: { credentialId: string | null }, credential: ResolvedCredentialRef) {
    return credential.source === 'team_credential' ? (credential.referenceId ?? null) : resource.credentialId;
  }

  private async resolveDirectQueryCredential(
    teamId: string, resource: ManagedResourceForConnection, credentialId: string,
    action: ResourceActionDefinition, optional = false,
  ): Promise<ResolvedCredentialRef | null> {
    const credential = await this.repo.findTeamCredential({
      where: { id: credentialId, teamId }, select: { id: true, name: true, type: true },
    });
    if (!credential) {
      if (optional) return null;
      throw new NotFoundException('只读查询凭据不存在或不属于当前团队');
    }
    if (!isDirectQueryCredentialType(resource, credential.type)) {
      if (optional) return null;
      throw new BadRequestException('只读查询凭据类型与资源类型不匹配');
    }
    return {
      source: 'team_credential', credentialType: credential.type, referenceId: credential.id,
      displayName: credential.name, transport: 'direct_db', redacted: true,
      metadata: {
        credentialName: credential.name, credentialType: credential.type,
        provider: resource.provider, kind: resource.kind, action: action.key,
        secretMaterial: 'kept_in_direct_db_driver_boundary',
      },
    };
  }
}
