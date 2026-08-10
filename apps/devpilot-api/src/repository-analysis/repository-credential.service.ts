import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma, RepositoryConnection } from '@prisma/client';
import { repositoryError } from './repository-analysis-validation.utils';
import {
  RepositoryCredentialMaterial,
  RepositoryCredentialOption,
  ResolveCredentialInput,
} from './repository-analysis.types';

type StoredGitCredential = {
  username?: string;
  token?: string;
  privateKey?: string;
};

@Injectable()
export class RepositoryCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async listOptions(teamId: string, userId: string): Promise<RepositoryCredentialOption[]> {
    const [connections, credentials] = await Promise.all([
      this.prisma.gitConnection.findMany({
        where: { userId },
        select: { id: true, provider: true, username: true },
      }),
      this.prisma.teamCredential.findMany({
        where: { teamId, type: { in: ['git_https', 'git_ssh'] } },
        select: { id: true, type: true, name: true },
      }),
    ]);
    return [
      ...connections.map((item) => ({
        id: item.id,
        source: 'git_connection' as const,
        type: 'https_token' as const,
        label: `${item.provider} · ${item.username}`,
        provider: item.provider,
      })),
      ...credentials.map((item) => ({
        id: item.id,
        source: 'team_credential' as const,
        type: item.type === 'git_ssh' ? 'ssh_key' as const : 'https_token' as const,
        label: item.name,
      })),
    ];
  }

  async resolve(input: ResolveCredentialInput): Promise<RepositoryCredentialMaterial> {
    const selected = [
      input.gitProvider ? 'git' : null,
      input.teamCredentialId ? 'team' : null,
      input.inlineCredential ? 'inline' : null,
    ].filter(Boolean);
    if (input.visibility === 'public' && selected.length === 0) {
      return { kind: 'none', source: 'none', label: '公开仓库' };
    }
    if (selected.length !== 1) {
      throw new BadRequestException(repositoryError(
        'REPOSITORY_CREDENTIAL_INVALID',
        '私有仓库必须且只能选择一种凭据',
        '请选择已有 Git 连接、团队仓库凭据，或填写一份新凭据。',
      ));
    }
    if (input.gitProvider) return this.resolveGitConnection(input);
    if (input.teamCredentialId) return this.resolveTeamCredential(input);
    const credential = input.inlineCredential!;
    return credential.type === 'ssh_key'
      ? {
          kind: 'ssh_key',
          source: 'inline',
          label: credential.name,
          username: credential.username,
          secret: credential.secret,
        }
      : {
          kind: 'https_token',
          source: 'inline',
          label: credential.name,
          username: credential.username || 'oauth2',
          secret: credential.secret,
        };
  }

  async persistInline(
    teamId: string,
    material: RepositoryCredentialMaterial,
    tx?: Prisma.TransactionClient,
  ): Promise<RepositoryCredentialMaterial> {
    if (material.source !== 'inline') return material;
    const config = material.kind === 'ssh_key'
      ? { username: material.username, privateKey: material.secret }
      : { username: material.username, token: material.secret };
    const stored = await (tx || this.prisma).teamCredential.create({
      data: {
        teamId,
        type: material.kind === 'ssh_key' ? 'git_ssh' : 'git_https',
        name: material.label,
        config: this.crypto.encryptGcm(JSON.stringify(config)),
      },
    });
    return { ...material, source: 'team_credential', teamCredentialId: stored.id };
  }

  async resolveStored(
    connection: RepositoryConnection,
  ): Promise<RepositoryCredentialMaterial> {
    if (connection.visibility === 'public' && connection.credentialSource === 'none') {
      return { kind: 'none', source: 'none', label: '公开仓库' };
    }
    if (connection.gitConnectionId) {
      const item = await this.prisma.gitConnection.findUnique({
        where: { id: connection.gitConnectionId },
      });
      if (!item) throw new NotFoundException(repositoryError(
        'REPOSITORY_CREDENTIAL_NOT_FOUND',
        '仓库连接使用的 Git 凭据已被移除',
        '请重新连接仓库并选择有效凭据。',
      ));
      return {
        kind: 'https_token',
        source: 'git_connection',
        label: `${item.provider} · ${item.username}`,
        username: item.username || 'oauth2',
        secret: this.crypto.decryptGcm(item.accessToken),
        gitConnectionId: item.id,
      };
    }
    return this.resolveTeamCredential({
      teamId: connection.teamId,
      userId: connection.connectedById || '',
      visibility: 'private',
      teamCredentialId: connection.teamCredentialId || undefined,
    });
  }

  private async resolveGitConnection(
    input: ResolveCredentialInput,
  ): Promise<RepositoryCredentialMaterial> {
    const connection = await this.prisma.gitConnection.findUnique({
      where: { userId_provider: { userId: input.userId, provider: input.gitProvider! } },
    });
    if (!connection) throw new NotFoundException(repositoryError(
      'REPOSITORY_CREDENTIAL_NOT_FOUND',
      '所选 Git 连接不存在或不属于当前用户',
      '请重新连接 Git 提供商后再试。',
    ));
    return {
      kind: 'https_token',
      source: 'git_connection',
      label: `${connection.provider} · ${connection.username}`,
      username: connection.username || 'oauth2',
      secret: this.crypto.decryptGcm(connection.accessToken),
      gitConnectionId: connection.id,
    };
  }

  private async resolveTeamCredential(
    input: ResolveCredentialInput,
  ): Promise<RepositoryCredentialMaterial> {
    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: input.teamCredentialId, teamId: input.teamId, type: { in: ['git_https', 'git_ssh'] } },
    });
    if (!credential) throw new NotFoundException(repositoryError(
      'REPOSITORY_CREDENTIAL_NOT_FOUND',
      '所选团队仓库凭据不存在',
      '请重新选择凭据，或创建一份新的只读仓库凭据。',
    ));
    const parsed = JSON.parse(this.crypto.decryptGcm(credential.config)) as StoredGitCredential;
    if (credential.type === 'git_ssh' && parsed.privateKey) {
      return {
        kind: 'ssh_key',
        source: 'team_credential',
        label: credential.name,
        username: parsed.username,
        secret: parsed.privateKey,
        teamCredentialId: credential.id,
      };
    }
    if (credential.type === 'git_https' && parsed.token) {
      return {
        kind: 'https_token',
        source: 'team_credential',
        label: credential.name,
        username: parsed.username || 'oauth2',
        secret: parsed.token,
        teamCredentialId: credential.id,
      };
    }
    throw new BadRequestException(repositoryError(
      'REPOSITORY_CREDENTIAL_INVALID',
      '仓库凭据内容不完整',
      '请更新凭据后重试。',
    ));
  }
}
