import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { requestContext, type LocalRequest } from '../policy/request-context.js';
import { ConfigService } from './config.service.js';
import { etag } from './config-input.dto.js';

@Controller('api/projects/:projectId/configs/:targetKey')
export class ConfigController {
  constructor(@Inject(ConfigService) private readonly configs: ConfigService) {}
  @Get('drafts') drafts(@Param('projectId') p: string, @Param('targetKey') t: string, @Req() req: LocalRequest) { return this.configs.drafts(p, t, requestContext(req)); }
  @Post('drafts') create(@Param('projectId') p: string, @Param('targetKey') t: string, @Body() body: Record<string, unknown>, @Req() req: LocalRequest) { return this.configs.create(p, t, body, requestContext(req)); }
  @Get('drafts/:id') draft(@Param('projectId') p: string, @Param('targetKey') t: string, @Param('id') id: string, @Req() req: LocalRequest) { return this.configs.draft(p, t, id, requestContext(req)); }
  @Patch('drafts/:id') update(@Param('projectId') p: string, @Param('targetKey') t: string, @Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: LocalRequest) { return this.configs.update(p, t, id, body, requestContext(req)); }
  @Post('drafts/:id/freeze') freeze(@Param('projectId') p: string, @Param('targetKey') t: string, @Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: LocalRequest) { return this.configs.freeze(p, t, id, body, requestContext(req)); }
  @Get('drafts/:id/preview') preview(@Param('projectId') p: string, @Param('targetKey') t: string, @Param('id') id: string, @Req() req: LocalRequest, @Query('etag') expected?: string) { return this.configs.preview(p, t, id, requestContext(req), expected === undefined ? undefined : etag(Number(expected))); }
  @Get('versions') versions(@Param('projectId') p: string, @Param('targetKey') t: string, @Req() req: LocalRequest) { return this.configs.versions(p, t, requestContext(req)); }
  @Get('versions/:id') version(@Param('projectId') p: string, @Param('targetKey') t: string, @Param('id') id: string, @Req() req: LocalRequest) { return this.configs.version(p, t, id, requestContext(req)); }
  @Post('versions/:id/archive') archive(@Param('projectId') p: string, @Param('targetKey') t: string, @Param('id') id: string, @Req() req: LocalRequest) { return this.configs.archive(p, t, id, requestContext(req)); }
}
