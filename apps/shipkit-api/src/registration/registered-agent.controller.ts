import { Body, Controller, Get, Header, Inject, Param, Post, Req } from '@nestjs/common';
import { requestContext, type LocalRequest } from '../policy/request-context.js';
import { RegisteredAgentService } from './registered-agent.service.js';

@Controller('api/registered-agents')
export class RegisteredAgentController {
  constructor(@Inject(RegisteredAgentService) private readonly agents: RegisteredAgentService) {}
  @Get() @Header('Cache-Control', 'no-store')
  list(@Req() request: LocalRequest) { return this.agents.list(requestContext(request)); }
  @Post('enrollments') @Header('Cache-Control', 'no-store')
  issue(@Req() request: LocalRequest, @Body() body: unknown) { return this.agents.issue(requestContext(request), body); }
  @Post('enrollments/:id/revoke') @Header('Cache-Control', 'no-store')
  revokeEnrollment(@Req() request: LocalRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.agents.revokeEnrollment(requestContext(request), id, body);
  }
  @Post(':id/disable') @Header('Cache-Control', 'no-store')
  disable(@Req() request: LocalRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.agents.setDisabled(requestContext(request), id, body);
  }
  @Post(':id/draining') @Header('Cache-Control', 'no-store')
  draining(@Req() request: LocalRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.agents.setDraining(requestContext(request), id, body);
  }
  @Post(':id/revoke') @Header('Cache-Control', 'no-store')
  revoke(@Req() request: LocalRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.agents.revoke(requestContext(request), id, body);
  }
  @Post(':id/rotate') @Header('Cache-Control', 'no-store')
  rotate(@Req() request: LocalRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.agents.rotate(requestContext(request), id, body);
  }
}
