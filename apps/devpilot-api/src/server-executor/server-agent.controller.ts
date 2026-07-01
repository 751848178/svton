import { Body, Controller, Headers, Post } from '@nestjs/common';
import {
  ServerAgentHeartbeatDto,
  ServerAgentTaskPullContractDto,
} from './dto/server-execution-lease.dto';
import { ServerExecutorService } from './server-executor.service';

@Controller('server-agent')
export class ServerAgentController {
  constructor(private readonly serverExecutorService: ServerExecutorService) {}

  @Post('heartbeat')
  heartbeat(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: ServerAgentHeartbeatDto,
  ) {
    return this.serverExecutorService.recordServerAgentHeartbeat(headers, dto);
  }

  @Post('task-pull/contract')
  taskPullContract(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: ServerAgentTaskPullContractDto,
  ) {
    return this.serverExecutorService.readServerAgentTaskPullContract(headers, dto);
  }
}
