import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { GithubProvider } from './providers/github.provider';
import { GitlabProvider } from './providers/gitlab.provider';
import { GiteeProvider } from './providers/gitee.provider';
import { GitProvider, GitRepo, CreateRepoOptions } from './interfaces/git-provider.interface';

type ProviderType = 'github' | 'gitlab' | 'gitee';

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);
  private readonly providers: Map<string, GitProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly githubProvider: GithubProvider,
    private readonly gitlabProvider: GitlabProvider,
    private readonly giteeProvider: GiteeProvider,
  ) {
    this.providers = new Map<string, GitProvider>([
      ['github', githubProvider],
      ['gitlab', gitlabProvider],
      ['gitee', giteeProvider],
    ]);
  }

  private encrypt(text: string): string {
    return this.cryptoService.encryptGcm(text);
  }

  private decrypt(encryptedText: string): string {
    return this.cryptoService.decryptGcm(encryptedText);
  }

  private getProvider(provider: ProviderType): GitProvider {
    const p = this.providers.get(provider);
    if (!p) {
      throw new BadRequestException(`不支持的 Git 提供商: ${provider}`);
    }
    return p;
  }

  // 保存 Git 连接
  async saveConnection(
    userId: string,
    provider: ProviderType,
    accessToken: string,
    refreshToken?: string,
  ) {
    const gitProvider = this.getProvider(provider);
    const user = await gitProvider.getUser(accessToken);

    const encryptedToken = this.encrypt(accessToken);
    const encryptedRefresh = refreshToken ? this.encrypt(refreshToken) : null;

    await this.prisma.gitConnection.upsert({
      where: {
        userId_provider: { userId, provider },
      },
      create: {
        userId,
        provider,
        accessToken: encryptedToken,
        refreshToken: encryptedRefresh,
        username: user.username,
      },
      update: {
        accessToken: encryptedToken,
        refreshToken: encryptedRefresh,
        username: user.username,
      },
    });

    this.logger.log(`Git connection saved: ${provider} for user ${userId}`);

    return {
      provider,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
    };
  }

  // 获取用户的 Git 连接
  async getConnections(userId: string) {
    const connections = await this.prisma.gitConnection.findMany({
      where: { userId },
    });

    return connections.map((c) => ({
      provider: c.provider,
      username: c.username,
      connectedAt: c.createdAt,
    }));
  }

  // 删除 Git 连接
  async removeConnection(userId: string, provider: ProviderType) {
    await this.prisma.gitConnection.delete({
      where: {
        userId_provider: { userId, provider },
      },
    });

    this.logger.log(`Git connection removed: ${provider} for user ${userId}`);
    return { success: true };
  }

  // 获取仓库列表
  async listRepos(userId: string, provider: ProviderType): Promise<GitRepo[]> {
    const connection = await this.prisma.gitConnection.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });

    if (!connection) {
      throw new NotFoundException(`未连接 ${provider}`);
    }

    const accessToken = this.decrypt(connection.accessToken);
    const gitProvider = this.getProvider(provider);

    return gitProvider.listRepos(accessToken);
  }

  // 创建仓库
  async createRepo(
    userId: string,
    provider: ProviderType,
    options: CreateRepoOptions,
  ): Promise<GitRepo> {
    const connection = await this.prisma.gitConnection.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });

    if (!connection) {
      throw new NotFoundException(`未连接 ${provider}`);
    }

    const accessToken = this.decrypt(connection.accessToken);
    const gitProvider = this.getProvider(provider);

    return gitProvider.createRepo(accessToken, options);
  }

  // 推送文件到仓库
  async pushToRepo(
    userId: string,
    provider: ProviderType,
    repo: string,
    files: { path: string; content: string }[],
    message = 'Initial commit from Svton Initializer',
  ) {
    const connection = await this.prisma.gitConnection.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });

    if (!connection) {
      throw new NotFoundException(`未连接 ${provider}`);
    }

    const accessToken = this.decrypt(connection.accessToken);
    const gitProvider = this.getProvider(provider);

    await gitProvider.pushFiles(accessToken, repo, files, message);

    return { success: true, repo };
  }
}
