/**
 * Prisma access boundary for the resource-request feature.
 *
 * Encapsulates every `where` / `include` / transaction shape that the
 * `ResourceRequestService` previously held inline, so the service and its
 * future focused sub-services stop owning Prisma query shapes directly.
 * Follows the `resource-pool.repository.ts` convention: each method takes the
 * exact argument object the underlying Prisma call would take and forwards it
 * unchanged, which keeps the extraction a behavior-preserving move.
 *
 * Shared `include` shapes live in `resource-request-includes.constants.ts`.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type PrismaAny = any;

@Injectable()
export class ResourceRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- resourceType ----

  findResourceTypeByUnique(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceType.findUnique(input);
  }

  findResourceTypeFirst(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceType.findFirst(input);
  }

  findResourceTypes(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceType.findMany(input);
  }

  createResourceType(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceType.create(input);
  }

  updateResourceType(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceType.update(input);
  }

  upsertResourceType(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceType.upsert(input);
  }

  // ---- access-scope relations ----

  findProject(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).project.findFirst(input);
  }

  findProjectEnvironment(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironment.findFirst(input);
  }

  findTeamCredential(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).teamCredential.findFirst(input);
  }

  // ---- resourceAuditLog ----

  createResourceAuditLog(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceAuditLog.create(input);
  }

  findResourceAuditLogs(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceAuditLog.findMany(input);
  }

  // ---- resourceRequest ----

  findRequestFirst(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceRequest.findFirst(input);
  }

  findRequests(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceRequest.findMany(input);
  }

  createRequest(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceRequest.create(input);
  }

  updateRequest(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceRequest.update(input);
  }

  // ---- resourceInstance ----

  findInstanceFirst(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceInstance.findFirst(input);
  }

  findInstances(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceInstance.findMany(input);
  }

  createInstance(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceInstance.create(input);
  }

  updateInstance(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceInstance.update(input);
  }

  // ---- resourceProvisioningRun ----

  findRunFirst(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceProvisioningRun.findFirst(input);
  }

  findRuns(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceProvisioningRun.findMany(input);
  }

  createRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceProvisioningRun.create(input);
  }

  updateRun(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceProvisioningRun.update(input);
  }

  updateRuns(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceProvisioningRun.updateMany(input);
  }
}
