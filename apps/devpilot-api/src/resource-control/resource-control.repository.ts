/**
 * Prisma access boundary for the resource-control feature.
 *
 * Encapsulates every `where` / `include` / write shape that
 * `ResourceControlService` previously held inline, so the service and its
 * future focused sub-services stop owning Prisma query shapes. Follows the
 * established `resource-request.repository.ts` convention: generic
 * `Record<string,unknown>` params, `(prisma as any)` access, one named method
 * per query intent, each forwarding its argument object unchanged.
 *
 * Shared `include` shapes live in `resource-control-includes.constants.ts`.
 * `where`-clause builders for list endpoints live in
 * `resource-control-query.utils.ts`.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type PrismaAny = any;

@Injectable()
export class ResourceControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- managedResource ----

  findManagedResource(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).managedResource.findFirst(input);
  }

  findManagedResources(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).managedResource.findMany(input);
  }

  upsertManagedResource(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).managedResource.upsert(input);
  }

  updateManagedResource(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).managedResource.update(input);
  }

  // ---- access-scope relations ----

  findProject(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).project.findFirst(input);
  }

  findProjectEnvironment(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironment.findFirst(input);
  }

  upsertProjectEnvironmentServer(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironmentServer.upsert(input);
  }

  findServer(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).server.findFirst(input);
  }

  updateServer(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).server.update(input);
  }

  findTeamCredential(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).teamCredentials.findFirst(input);
  }

  // ---- resourceActionRun ----

  findActionRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceActionRun.findFirst(input);
  }

  findActionRuns(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceActionRun.findMany(input);
  }

  createActionRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceActionRun.create(input);
  }

  updateActionRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceActionRun.update(input);
  }

  // ---- resourceConnectionRun ----

  findConnectionRuns(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceConnectionRun.findMany(input);
  }

  createConnectionRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceConnectionRun.create(input);
  }

  updateConnectionRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceConnectionRun.update(input);
  }

  // ---- resourceQueryRun ----

  findQueryRuns(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceQueryRun.findMany(input);
  }

  createQueryRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceQueryRun.create(input);
  }

  updateQueryRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceQueryRun.update(input);
  }

  // ---- resourceSyncRun ----

  findSyncRuns(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceSyncRun.findMany(input);
  }

  createSyncRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceSyncRun.create(input);
  }

  updateSyncRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceSyncRun.update(input);
  }

  // ---- resourceMetricSnapshot ----

  countMetricSnapshots(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceMetricSnapshot.count(input);
  }

  findMetricSnapshots(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceMetricSnapshot.findMany(input);
  }

  createManyMetricSnapshots(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceMetricSnapshot.createMany(input);
  }
}
