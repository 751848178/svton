import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { LiveProject, RepositorySource } from 'shipkit/platform';
import { DatabaseService } from '../database/database.service.js';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { executionError } from '../transport/execution-error.js';
import { metadata, stringField } from './project-input.dto.js';
import { contextAudit, ProjectRepository } from './project.repository.js';
import { ProjectSourceService } from './project-source.service.js';
import { repositoryInput, repositoryToken, repositoryUsername, repositoryView } from './repository-input.dto.js';
import { projectView } from './project.view.js';

@Injectable()
export class RepositoryProjectService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ProjectRepository) private readonly projects: ProjectRepository,
    @Inject(ProjectSourceService) private readonly sources: ProjectSourceService,
    @Inject(PlatformExecutorService) private readonly executor: PlatformExecutorService,
    @Inject(LocalPolicyService) private readonly policy: LocalPolicyService) {}

  async preview(body: Record<string, unknown>, context: RequestContext) {
    this.policy.authorize(context, 'project.register');
    const repository = repositoryInput(body.repository);
    const token = repositoryToken(body.token) ?? undefined;
    const username = repositoryUsername(body.username) ?? undefined;
    const sourceSnapshot = await this.resolve(repository, token, username);
    if (body.expectedCommit !== undefined && body.expectedCommit !== sourceSnapshot.commit) throw new ConflictException('仓库提交已变化，请重新预览并核对');
    return { sourceSnapshot, defaultBranch: repository.ref.value ? undefined : sourceSnapshot.requestedRef.value };
  }

  async register(body: Record<string, unknown>, context: RequestContext) {
    this.policy.authorize(context, 'project.register');
    const id = randomUUID();
    const name = stringField(body.name, '项目名称', true)!;
    const repository = repositoryInput(body.repository);
    const token = repositoryToken(body.token) ?? undefined;
    const username = repositoryUsername(body.username) ?? undefined;
    if (username && !token) throw new BadRequestException('Git 访问用户名需要同时提供只读令牌');
    const configPath = await realpath(path.resolve(stringField(body.configPath, '连接配置路径', true)!)).catch(() => { throw new BadRequestException('连接配置引用不存在'); });
    if (!(await stat(configPath)).isFile()) throw new BadRequestException('连接配置引用不是文件');
    const targetKey = stringField(body.targetKey, '运行目标');
    const sourceSnapshot = await this.resolve(repository, token, username);
    repository.ref = sourceSnapshot.requestedRef;
    if (body.expectedCommit !== undefined && body.expectedCommit !== sourceSnapshot.commit) throw new ConflictException('仓库提交已变化，请重新预览并核对');
    const rootPath = `/repository/${id}`;
    const live = await this.executor.inspectProject({ rootPath, configPath, targetKey, repository,
      sourceSnapshot, appName: sourceSnapshot.appName }, { repository: { token, username } }) as LiveProject;
    const services = metadata(body.services) ?? [];
    if (services.some(item => !live.services.some(service => item.serviceKey === service.serviceKey))) throw new BadRequestException('服务元数据不属于当前发布定义');
    const duplicate = await this.db.project.findFirst({ where: { workspaceId: context.workspaceId,
      projectIdentity: live.projectIdentity, appName: sourceSnapshot.appName, targetKey: live.targetKey } });
    if (duplicate) throw new ConflictException('同一仓库应用与运行目标已登记，请使用已有项目');
    const project = await this.projects.register({ id, name, rootPath, configPath, targetKey: live.targetKey,
      sourceKind: 'repository', sourceRevision: 1, appName: sourceSnapshot.appName,
      repositoryJson: JSON.stringify({ ...repository, hasUsername: Boolean(username) }), repositorySecret: token ? this.sources.sealToken(token, id, 1, username) : null,
      projectIdentity: live.projectIdentity, workspace: { connect: { id: context.workspaceId } },
      createdBy: { connect: { id: context.actorId } },
      targets: { create: live.targets.map(target => ({ targetKey: target.targetKey, displayName: target.targetKey === live.targetKey ? stringField(body.serverName, '目标显示名') : undefined })) },
      services: { create: live.services.map(service => ({ ...services.find(item => item.serviceKey === service.serviceKey), serviceKey: service.serviceKey })) },
    }, context);
    return projectView(project);
  }

  async get(id: string, context: RequestContext) {
    const project = await this.projects.get(id, context.workspaceId);
    this.policy.authorize(context, 'project.read', project.workspaceId);
    const source = this.sources.source(project);
    if (!source) throw new BadRequestException('此项目使用已有目录来源');
    return { repository: repositoryView(source), hasCredential: Boolean(project.repositorySecret), hasUsername: this.sources.hasUsername(project) };
  }

  async previewSaved(id: string, body: Record<string, unknown>, context: RequestContext) {
    const project = await this.projects.get(id, context.workspaceId);
    this.policy.authorize(context, 'project.read', project.workspaceId);
    if (project.sourceKind !== 'repository') throw new BadRequestException('此项目使用已有目录来源');
    const repository = repositoryInput(body.repository);
    if (repository.repoUrl !== this.sources.source(project)!.repoUrl) throw new BadRequestException('仓库身份不能在预览中变更；请使用项目接入');
    const supplied = repositoryToken(body.token);
    const saved = this.sources.credentials(project), suppliedUsername = repositoryUsername(body.username);
    const token = supplied === undefined ? saved.token : supplied ?? undefined;
    const username = supplied === null ? undefined : suppliedUsername === undefined ? saved.username : suppliedUsername ?? undefined;
    const sourceSnapshot = await this.resolve(repository, token, username);
    return { sourceSnapshot, defaultBranch: repository.ref.value ? undefined : sourceSnapshot.requestedRef.value };
  }

  async update(id: string, body: Record<string, unknown>, context: RequestContext) {
    const project = await this.projects.get(id, context.workspaceId);
    this.policy.authorize(context, 'project.metadata', project.workspaceId);
    if (project.sourceKind !== 'repository') throw new BadRequestException('目录来源需显式迁移，不能直接切换仓库身份');
    if (body.revision !== project.sourceRevision) throw new ConflictException('仓库设置已更新，请刷新后重试');
    const revision = project.sourceRevision + 1;
    const repository = repositoryInput(body.repository, revision);
    const old = this.sources.source(project)!;
    if (repository.repoUrl !== old.repoUrl) throw new BadRequestException('仓库身份变更需要显式迁移；这里只修改 ref、定义路径或凭据');
    const supplied = repositoryToken(body.token);
    const saved = this.sources.credentials(project), suppliedUsername = repositoryUsername(body.username);
    const token = supplied === undefined ? saved.token : supplied ?? undefined;
    const username = supplied === null ? undefined : suppliedUsername === undefined ? saved.username : suppliedUsername ?? undefined;
    if (username && !token) throw new BadRequestException('Git 访问用户名需要同时提供只读令牌');
    const snapshot = await this.resolve(repository, token, username);
    if (body.expectedCommit !== undefined && body.expectedCommit !== snapshot.commit) throw new ConflictException('仓库提交已变化，请重新预览并核对');
    if (snapshot.appName !== project.appName) throw new BadRequestException('应用名称发生变化，需要显式迁移');
    repository.ref = snapshot.requestedRef;
    await this.db.$transaction(async tx => {
      if (await tx.task.findFirst({ where: { projectId: id, activeScope: { not: null } } })) throw new ConflictException('发布仍在执行，暂不能修改仓库设置');
      const result = await tx.project.updateMany({ where: { id, sourceRevision: project.sourceRevision }, data: {
        sourceRevision: revision, repositoryJson: JSON.stringify({ ...repository, hasUsername: Boolean(username) }), repositorySecret: token ? this.sources.sealToken(token, id, revision, username) : null,
      } });
      if (!result.count) throw new ConflictException('仓库设置已更新，请刷新后重试');
      for (const serviceKey of Object.keys(snapshot.spec.services)) await tx.service.upsert({
        where: { projectId_serviceKey: { projectId: id, serviceKey } }, update: {}, create: { projectId: id, serviceKey },
      });
      await tx.audit.create({ data: { ...contextAudit(context), action: 'project.repository.update', resourceType: 'project', resourceId: id, outcome: 'succeeded' } });
    });
    return { repository: repositoryView(repository), hasCredential: Boolean(token), hasUsername: Boolean(username) };
  }

  private async resolve(repository: RepositorySource, token?: string, username?: string) {
    try { return await this.executor.resolveRepositorySource(repository, { token, username }); }
    catch (error) {
      let message = executionError(error);
      if (token) for (const secret of [token, encodeURIComponent(token)]) message = message.split(secret).join('[redacted]');
      throw new BadRequestException(`仓库检查失败：${message}`);
    }
  }
}
