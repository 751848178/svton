import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import type { LocalRequest } from '../policy/request-context.js';
import { requestContext } from '../policy/request-context.js';
import { PlanService } from '../tasks/plan.service.js';
import { TaskService } from '../tasks/task.service.js';
import { ProjectService } from './project.service.js';
import { RepositoryProjectService } from './repository-project.service.js';

@Controller('api/projects')
export class ProjectController {
  constructor(
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(PlanService) private readonly plans: PlanService,
    @Inject(TaskService) private readonly tasks: TaskService,
    @Inject(RepositoryProjectService) private readonly repositories: RepositoryProjectService,
  ) {}
  @Get() list(@Req() request: LocalRequest): Promise<unknown> { return this.projects.list(requestContext(request)); }
  @Post() register(@Body() body: Record<string, unknown>, @Req() request: LocalRequest): Promise<unknown> {
    return body.sourceKind === 'repository' ? this.repositories.register(body, requestContext(request)) : this.projects.register(body, requestContext(request));
  }
  @Get(':id') async get(@Param('id') id: string, @Req() request: LocalRequest): Promise<unknown> { return this.projects.view(await this.projects.get(id, requestContext(request))); }
  @Patch(':id') patch(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() request: LocalRequest): Promise<unknown> { return this.projects.patch(id, body, requestContext(request)); }
  @Get(':id/status') status(@Param('id') id: string, @Req() request: LocalRequest): Promise<unknown> { return this.projects.status(id, requestContext(request)); }
  @Post(':id/plans') plan(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() request: LocalRequest): Promise<unknown> { return this.plans.prepare(id, body, requestContext(request)); }
  @Get(':id/tasks') history(@Param('id') id: string, @Req() request: LocalRequest): Promise<unknown> { return this.tasks.list(id, requestContext(request)); }
  @Post(':id/tasks') start(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() request: LocalRequest): Promise<unknown> { return this.tasks.start(id, body, requestContext(request)); }
  @Get(':id/history') releases(@Param('id') id: string, @Req() request: LocalRequest): Promise<unknown> { return this.projects.history(id, requestContext(request)); }
  @Post(':id/checks') checks(@Param('id') id: string, @Req() request: LocalRequest): Promise<unknown> { return this.projects.checks(id, requestContext(request)); }
}
