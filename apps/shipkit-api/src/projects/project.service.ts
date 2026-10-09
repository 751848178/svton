import { BadRequestException, ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { LiveProject } from 'shipkit/platform';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { publicData } from '../transport/public-data.js';
import { registration, patchMetadata } from './project-input.dto.js';
import { ProjectRepository, type StoredProject } from './project.repository.js';
import { projectView } from './project.view.js';
import { ProjectSourceService, storedProjectInput } from './project-source.service.js';

@Injectable()
export class ProjectService {
  constructor(
    @Inject(ProjectRepository) readonly repository: ProjectRepository,
    @Inject(PlatformExecutorService) private readonly executor: PlatformExecutorService,
    @Inject(LocalPolicyService) private readonly policy: LocalPolicyService,
    @Optional() @Inject(ProjectSourceService) private readonly sources?: ProjectSourceService,
  ) {}
  async list(context: RequestContext): Promise<unknown> {
    this.policy.authorize(context, 'project.read');
    return { items: (await this.repository.list(context.workspaceId)).map(projectView) };
  }
  async get(id: string, context: RequestContext): Promise<StoredProject> {
    const project = await this.repository.get(id, context.workspaceId);
    this.policy.authorize(context, 'project.read', project.workspaceId);
    return project;
  }
  async register(body: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    this.policy.authorize(context, 'project.register');
    const request = registration(body);
    const rootPath = await realpath(path.resolve(request.rootPath)).catch(() => { throw new BadRequestException('项目目录不存在'); });
    const configPath = await realpath(path.resolve(rootPath, request.configPath)).catch(() => { throw new BadRequestException('配置引用不存在'); });
    if (!(await stat(rootPath)).isDirectory() || !(await stat(configPath)).isFile()) throw new BadRequestException('项目目录或配置引用无效');
    const live = await this.executor.inspectProject({ rootPath, configPath, targetKey: request.targetKey }) as LiveProject;
    this.assertMetadata(live, request.services ?? [], request.targetKey ?? live.targetKey);
    try {
      return projectView(await this.repository.register({
        workspace: { connect: { id: context.workspaceId } }, name: request.name, rootPath, configPath,
        targetKey: live.targetKey, projectIdentity: live.projectIdentity, appName: live.name, createdBy: { connect: { id: context.actorId } },
        targets: { create: live.targets.map(({ targetKey }) => ({ targetKey, displayName: targetKey === live.targetKey ? request.serverName : undefined })) },
        services: { create: live.services.map(({ serviceKey }) => ({ ...request.services?.find((service) => service.serviceKey === serviceKey), serviceKey })) },
      }, context));
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('该目录已注册');
      throw error;
    }
  }
  async patch(id: string, body: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const project = await this.get(id, context);
    this.policy.authorize(context, 'project.metadata', project.workspaceId);
    const patch = patchMetadata(body);
    if (patch.targetKey && !project.targets.some((target) => target.targetKey === patch.targetKey)) throw new BadRequestException('不能重命名底层目标');
    if (patch.services?.some((service) => !project.services.some((stored) => stored.serviceKey === service.serviceKey))) throw new BadRequestException('元数据引用了未注册的服务');
    return projectView(await this.repository.patch(project, patch, context));
  }
  async status(id: string, context: RequestContext): Promise<unknown> {
    const project = await this.get(id, context);
    return { project: projectView(project), live: publicData(await this.executor.inspectProject(this.sources?.input(project) ?? storedProjectInput(project),
      project.sourceKind === 'repository' ? { repository: this.sources?.credentials(project) } : undefined)) };
  }
  async history(id: string, context: RequestContext): Promise<unknown> {
    const project = await this.get(id, context);
    return publicData(await this.executor.fetchHistory(this.sources?.input(project) ?? storedProjectInput(project)));
  }
  async checks(id: string, context: RequestContext): Promise<unknown> {
    const project = await this.get(id, context);
    this.policy.authorize(context, 'project.checks', project.workspaceId);
    return publicData(await this.executor.diagnoseProject(this.sources?.input(project) ?? storedProjectInput(project)));
  }
  private assertMetadata(live: LiveProject, services: { serviceKey: string }[], targetKey: string): void {
    if (!live.targets.some((target) => target.targetKey === targetKey)) throw new BadRequestException('目标未在真实配置中声明');
    if (services.some((item) => !live.services.some((service) => service.serviceKey === item.serviceKey))) throw new BadRequestException('服务未在真实 ship.yaml 中声明');
  }
}
