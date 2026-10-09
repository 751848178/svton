import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { requestContext, type LocalRequest } from '../policy/request-context.js';
import { AgentService } from './agent.service.js';

@Controller('api/agents')
export class AgentController {
  constructor(@Inject(AgentService) private readonly agents: AgentService) {}
  @Get() list(@Req() request: LocalRequest): Promise<unknown> { return this.agents.list(requestContext(request)); }
  @Post(':id/checks') check(@Param('id') id: string, @Body() body: unknown, @Req() request: LocalRequest): Promise<unknown> {
    if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length > 0)) {
      throw new BadRequestException('检查仅使用已配置资源，不接受地址或连接参数');
    }
    return this.agents.check(id, requestContext(request));
  }
}
