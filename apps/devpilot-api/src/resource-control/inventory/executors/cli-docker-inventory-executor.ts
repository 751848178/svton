import { Injectable } from '@nestjs/common';
import { DOCKER_PS_JSON_COMMAND } from '../docker-inventory';
import { ServerExecutorService } from '../../../server-executor/server-executor.service';
import {
  DockerContainerRecord,
  DockerInventoryExecutor,
  DockerInventoryQuery,
} from './docker-inventory-executor';

/**
 * 基于 server-executor SSH 远程执行 `docker ps` 的 inventory executor。
 *
 * 当前生产实现：在目标服务器上跑 `docker ps -a --no-trunc --format '{{json .}}'`，
 * 收集 stdout 的 JSON 行。适用于"远端服务器只装了 docker CLI、未开 daemon API"的场景。
 *
 * 这是 resource-control 的默认实现；当目标开了 Docker API 时由
 * {@link DockerInventoryExecutorFactory} 切换到 dockerode 实现。
 */
@Injectable()
export class CliDockerInventoryExecutor implements DockerInventoryExecutor {
  constructor(private readonly serverExecutorService: ServerExecutorService) {}

  async listContainers(query: DockerInventoryQuery): Promise<DockerContainerRecord[]> {
    const target = await this.serverExecutorService.resolveTarget(query.teamId, query.serverId);
    const execution = await this.serverExecutorService.execute({
      teamId: query.teamId,
      operationKey: 'resource.sync_docker_inventory',
      adapterKey: 'docker-inventory-plan',
      dryRun: false,
      target,
      steps: [
        {
          key: 'docker-ps-json',
          label: 'list docker containers as json lines',
          command: DOCKER_PS_JSON_COMMAND,
          required: true,
          risk: 'low',
          timeoutSeconds: 30,
        },
      ],
      metadata: { source: 'cli-docker-inventory-executor' },
    });
    if (execution.status !== 'completed') {
      return [];
    }
    const stdout = this.readStdout(execution);
    if (!stdout) return [];
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{'))
      .map((line) => this.parseLine(line))
      .filter((record): record is DockerContainerRecord => record !== null);
  }

  private readStdout(execution: { logs?: unknown; result?: unknown }): string | undefined {
    const logs = Array.isArray(execution.logs) ? execution.logs : [];
    const stdoutLine = logs.find(
      (line) => line && typeof line === 'object' && (line as { stream?: string }).stream === 'stdout',
    );
    return stdoutLine ? String((stdoutLine as { message?: unknown }).message ?? '') : undefined;
  }

  private parseLine(line: string): DockerContainerRecord | null {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      return {
        ID: String(parsed.ID ?? parsed.Id ?? ''),
        Image: String(parsed.Image ?? ''),
        Names: String(parsed.Names ?? ''),
        Ports: String(parsed.Ports ?? ''),
        State: String(parsed.State ?? ''),
        Status: String(parsed.Status ?? ''),
        Labels: String(parsed.Labels ?? ''),
        Networks: String(parsed.Networks ?? ''),
        RunningFor: String(parsed.RunningFor ?? ''),
      };
    } catch {
      return null;
    }
  }
}
