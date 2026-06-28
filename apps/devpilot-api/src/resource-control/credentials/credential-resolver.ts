import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ResourceActionDefinition } from '../actions/resource-actions';

export type ResourceForCredentialResolution = {
  id: string;
  sourceType: string;
  provider: string;
  kind: string;
  name: string;
  serverId?: string | null;
  credentialId?: string | null;
};

export type ResolvedCredentialRef = {
  source: 'server' | 'team_credential' | 'none';
  credentialType: string;
  referenceId?: string;
  displayName?: string;
  transport: 'ssh' | 'cloud_sdk' | 'direct_db' | 'none';
  redacted: true;
  metadata: Prisma.InputJsonValue;
};

export interface ResourceCredentialResolver {
  resolve(
    teamId: string,
    resource: ResourceForCredentialResolution,
    action: ResourceActionDefinition,
  ): Promise<ResolvedCredentialRef>;
}

@Injectable()
export class DefaultCredentialResolver implements ResourceCredentialResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    teamId: string,
    resource: ResourceForCredentialResolution,
    action: ResourceActionDefinition,
  ): Promise<ResolvedCredentialRef> {
    if (resource.sourceType === 'server') {
      return this.resolveServerCredential(teamId, resource, action);
    }

    if (resource.sourceType === 'cloud') {
      return this.resolveCloudCredential(teamId, resource, action);
    }

    return {
      source: 'none',
      credentialType: 'none',
      transport: 'none',
      redacted: true,
      metadata: { reason: 'manual resource does not have a credential binding yet' },
    };
  }

  private async resolveServerCredential(
    teamId: string,
    resource: ResourceForCredentialResolution,
    action: ResourceActionDefinition,
  ): Promise<ResolvedCredentialRef> {
    if (!resource.serverId) {
      throw new NotFoundException('资源未绑定服务器，无法解析 Server executor 授权');
    }

    const server = await this.prisma.server.findFirst({
      where: { id: resource.serverId, teamId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
      },
    });

    if (!server) {
      throw new NotFoundException('服务器授权不存在或不属于当前团队');
    }

    return {
      source: 'server',
      credentialType: `server_${server.authType}`,
      referenceId: server.id,
      displayName: `${server.username}@${server.host}:${server.port}`,
      transport: 'ssh',
      redacted: true,
      metadata: {
        serverName: server.name,
        host: server.host,
        port: server.port,
        username: server.username,
        authType: server.authType,
        action: action.key,
        secretMaterial: 'kept_in_server_executor_boundary',
      },
    };
  }

  private async resolveCloudCredential(
    teamId: string,
    resource: ResourceForCredentialResolution,
    action: ResourceActionDefinition,
  ): Promise<ResolvedCredentialRef> {
    if (!resource.credentialId) {
      return {
        source: 'none',
        credentialType: 'cloud_unbound',
        transport: 'cloud_sdk',
        redacted: true,
        metadata: {
          provider: resource.provider,
          action: action.key,
          warning: 'resource has no TeamCredential binding yet',
        },
      };
    }

    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: resource.credentialId, teamId },
      select: { id: true, name: true, type: true },
    });

    if (!credential) {
      throw new NotFoundException('云资源凭证不存在或不属于当前团队');
    }

    return {
      source: 'team_credential',
      credentialType: credential.type,
      referenceId: credential.id,
      displayName: credential.name,
      transport: 'cloud_sdk',
      redacted: true,
      metadata: {
        credentialName: credential.name,
        credentialType: credential.type,
        provider: resource.provider,
        action: action.key,
        secretMaterial: 'kept_in_cloud_executor_boundary',
      },
    };
  }
}
