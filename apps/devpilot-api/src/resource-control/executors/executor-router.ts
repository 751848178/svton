import { BadRequestException, Injectable } from '@nestjs/common';
import { CloudSdkExecutor } from './cloud-sdk.executor';
import { ExecuteResourceActionInput, ResourceExecutor } from './executor.types';
import { ServerScriptExecutor } from './server-script.executor';

@Injectable()
export class ResourceExecutorRouter {
  private readonly executors: ResourceExecutor[];

  constructor(
    private readonly serverScriptExecutor: ServerScriptExecutor,
    private readonly cloudSdkExecutor: CloudSdkExecutor,
  ) {
    this.executors = [this.serverScriptExecutor, this.cloudSdkExecutor];
  }

  resolve(input: ExecuteResourceActionInput) {
    const executorKey = this.normalizeExecutorKey(input);
    const executor = this.executors.find(
      (candidate) => candidate.key === executorKey && candidate.supports(input),
    );

    if (!executor) {
      throw new BadRequestException(
        `No executor supports action ${input.action.key} for ${input.resource.sourceType}/${input.resource.provider}/${input.resource.kind}`,
      );
    }

    return executor;
  }

  private normalizeExecutorKey(input: ExecuteResourceActionInput) {
    if (input.action.executorKey !== 'auto') {
      return input.action.executorKey;
    }

    if (input.resource.sourceType === 'server') {
      return 'server-executor';
    }
    if (input.resource.sourceType === 'cloud') {
      return 'cloud-sdk';
    }

    return input.action.executorKey;
  }
}
