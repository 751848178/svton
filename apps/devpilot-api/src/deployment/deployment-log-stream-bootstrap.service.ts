import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateLogStreamDto } from '../log-center/dto/log-center.dto';
import { LogCenterService } from '../log-center/log-center.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Context needed to bootstrap a docker log stream after a successful
 * (non-dry-run) deployment. Mirrors the subset of an ApplicationService
 * record that the deployment flow already has loaded.
 */
export type DeploymentLogStreamContext = {
  teamId: string;
  actorId?: string | null;
  projectId: string;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId: string;
  applicationServiceName: string;
  serverId?: string | null;
  /** Raw deployConfig JSON of the application service (holds containerName etc.). */
  deployConfig: Prisma.JsonValue | null;
};

/**
 * Auto-creates a docker LogStream bound to an application service + server so
 * that container logs are immediately viewable after a successful deployment,
 * without the user having to create a stream by hand.
 *
 * Responsibilities are intentionally narrow: dedup-then-create only. The
 * deployment service is responsible for making this best-effort (it wraps the
 * call in try/catch so a failure never breaks a deploy).
 */
@Injectable()
export class DeploymentLogStreamBootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logCenterService: LogCenterService,
  ) {}

  /**
   * Ensures a docker LogStream exists for the given application service +
   * server. Returns the existing stream if one already matches the dedup key
   * (applicationServiceId + serverId + sourceType='docker'), otherwise creates
   * one via the shared log-center creation path. Throws on unexpected errors —
   * the caller decides how to handle them.
   */
  async ensureDockerLogStream(ctx: DeploymentLogStreamContext) {
    const existing = await this.findExistingDockerStream(ctx);
    if (existing) {
      return existing;
    }

    const containerName = readContainerName(ctx.deployConfig);
    const dto = this.buildCreateDto(ctx, containerName);
    return this.logCenterService.createStream(
      ctx.teamId,
      ctx.actorId ?? 'system',
      dto,
    );
  }

  private async findExistingDockerStream(ctx: DeploymentLogStreamContext) {
    return this.prisma.logStream.findFirst({
      where: {
        teamId: ctx.teamId,
        sourceType: 'docker',
        applicationServiceId: ctx.applicationServiceId,
        // serverId is nullable — match the exact value (incl. null) so a
        // server-less stream isn't mistaken for a server-bound one.
        serverId: ctx.serverId ?? null,
      },
      select: { id: true },
    });
  }

  private buildCreateDto(
    ctx: DeploymentLogStreamContext,
    containerName: string | undefined,
  ): CreateLogStreamDto {
    const dto = {
      name: `${ctx.applicationServiceName} 容器日志`,
      sourceType: 'docker' as const,
      sourceKey: containerName,
      projectId: ctx.projectId,
      environmentId: ctx.environmentId ?? undefined,
      applicationId: ctx.applicationId ?? undefined,
      applicationServiceId: ctx.applicationServiceId,
      serverId: ctx.serverId ?? undefined,
      metadata: {
        autoCreated: true,
        deploymentBootstrap: true,
        containerName: containerName ?? null,
      },
    };
    return dto as CreateLogStreamDto;
  }
}

/**
 * Derives the docker container name from an application service's deployConfig,
 * mirroring the resolution order used by the server log-collection plan
 * (log-server-collection-plan.utils.ts buildDockerLogStep): containerName is
 * preferred, with container as an alias. Returns undefined when no usable
 * value is found — the collection plan then falls back to the service name at
 * collection time.
 */
export function readContainerName(
  deployConfigValue: Prisma.JsonValue | null,
): string | undefined {
  if (
    !deployConfigValue ||
    typeof deployConfigValue !== 'object' ||
    Array.isArray(deployConfigValue)
  ) {
    return undefined;
  }
  const config = deployConfigValue as Record<string, unknown>;
  const candidates = [config.containerName, config.container];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed && /^[a-zA-Z0-9_.:/@-]+$/.test(trimmed)) {
      return trimmed;
    }
  }
  return undefined;
}
