import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import type { LocalRequest } from '../policy/request-context.js';
import { requestContext } from '../policy/request-context.js';
import { RepositoryProjectService } from './repository-project.service.js';

@Controller('api/repositories')
export class RepositoryPreviewController {
  constructor(@Inject(RepositoryProjectService) private readonly repositories: RepositoryProjectService) {}
  @Post('preview') preview(@Body() body: Record<string, unknown>, @Req() request: LocalRequest) {
    return this.repositories.preview(body, requestContext(request));
  }
}

@Controller('api/projects/:id/repository')
export class ProjectRepositoryController {
  constructor(@Inject(RepositoryProjectService) private readonly repositories: RepositoryProjectService) {}
  @Get() get(@Param('id') id: string, @Req() request: LocalRequest) { return this.repositories.get(id, requestContext(request)); }
  @Post('preview') preview(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() request: LocalRequest) {
    return this.repositories.previewSaved(id, body, requestContext(request));
  }
  @Patch() update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() request: LocalRequest) {
    return this.repositories.update(id, body, requestContext(request));
  }
}
