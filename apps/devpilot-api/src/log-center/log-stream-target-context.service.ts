import { Injectable } from "@nestjs/common";
import { CreateLogStreamDto } from "./dto/log-center.dto";
import { LogStreamLinkedTargetContextService } from "./log-stream-linked-target-context.service";
import { LogStreamSourceTargetContextService } from "./log-stream-source-target-context.service";
import { LogStreamTargetContext } from "./log-stream-target-context.types";

@Injectable()
export class LogStreamTargetContextService {
  constructor(
    private readonly linkedTargets: LogStreamLinkedTargetContextService,
    private readonly sourceTargets: LogStreamSourceTargetContextService,
  ) {}

  async resolve(
    teamId: string,
    dto: CreateLogStreamDto,
  ): Promise<LogStreamTargetContext> {
    const linkedTarget = await this.linkedTargets.resolve(teamId, dto);
    if (linkedTarget) return linkedTarget;
    return this.sourceTargets.resolve(teamId, dto);
  }
}
