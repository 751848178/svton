import { Body, Controller, Headers, Post } from "@nestjs/common";
import {
  ServerAgentHeartbeatDto,
  ServerAgentTaskPullAckDto,
  ServerAgentTaskPullClaimDto,
  ServerAgentTaskPullContractDto,
  ServerAgentTaskPullFinishDto,
} from "./dto/server-execution-lease.dto";
import { ServerAgentTaskPullAckService } from "./server-agent-task-pull-ack.service";
import { ServerAgentTaskPullClaimService } from "./server-agent-task-pull-claim.service";
import { ServerAgentTaskPullFinishService } from "./server-agent-task-pull-finish.service";
import { ServerExecutorService } from "./server-executor.service";

@Controller("server-agent")
export class ServerAgentController {
  constructor(
    private readonly serverExecutorService: ServerExecutorService,
    private readonly taskPullAckService: ServerAgentTaskPullAckService,
    private readonly taskPullClaimService: ServerAgentTaskPullClaimService,
    private readonly taskPullFinishService: ServerAgentTaskPullFinishService,
  ) {}

  @Post("heartbeat")
  heartbeat(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: ServerAgentHeartbeatDto,
  ) {
    return this.serverExecutorService.recordServerAgentHeartbeat(headers, dto);
  }

  @Post("task-pull/contract")
  taskPullContract(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: ServerAgentTaskPullContractDto,
  ) {
    return this.serverExecutorService.readServerAgentTaskPullContract(
      headers,
      dto,
    );
  }

  @Post("task-pull/claim")
  taskPullClaim(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: ServerAgentTaskPullClaimDto,
  ) {
    return this.taskPullClaimService.claim(headers, dto);
  }

  @Post("task-pull/ack")
  taskPullAck(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: ServerAgentTaskPullAckDto,
  ) {
    return this.taskPullAckService.ack(headers, dto);
  }

  @Post("task-pull/finish")
  taskPullFinish(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: ServerAgentTaskPullFinishDto,
  ) {
    return this.taskPullFinishService.finish(headers, dto);
  }
}
