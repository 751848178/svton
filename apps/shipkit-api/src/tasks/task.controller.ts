import { Controller, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import type { LocalRequest } from '../policy/request-context.js';
import { requestContext } from '../policy/request-context.js';
import { TaskService } from './task.service.js';

@Controller('api/tasks')
export class TaskController {
  constructor(@Inject(TaskService) private readonly tasks: TaskService) {}
  @Get(':id') detail(@Param('id') id: string, @Req() request: LocalRequest): Promise<unknown> { return this.tasks.detail(id, requestContext(request)); }
  @Get(':id/events') events(@Param('id') id: string, @Query('after') after = '0', @Req() request: LocalRequest): Promise<unknown> { return this.tasks.events(id, Number(after), requestContext(request)); }
  @Get(':id/logs') logs(@Param('id') id: string, @Query('stage') stage: string, @Query('service') service: string | undefined, @Query('offset') offset = '0', @Req() request: LocalRequest): Promise<unknown> { return this.tasks.log(id, stage, service, Number(offset), requestContext(request)); }
  @Post(':id/cancel') cancel(@Param('id') id: string, @Req() request: LocalRequest): Promise<unknown> { return this.tasks.cancel(id, requestContext(request)); }
  @Post(':id/cleanup') cleanup(@Param('id') id: string, @Req() request: LocalRequest): Promise<unknown> { return this.tasks.cleanup(id, requestContext(request)); }
}
