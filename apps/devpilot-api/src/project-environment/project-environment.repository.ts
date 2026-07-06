/**
 * Prisma access boundary for the project-environment feature.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type PrismaAny = any;

@Injectable()
export class ProjectEnvironmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProject(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).project.findFirst(input);
  }
  findProjectEnvironment(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironment.findFirst(input);
  }
  findProjectEnvironments(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironment.findMany(input);
  }
  createProjectEnvironment(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironment.create(input);
  }
  upsertProjectEnvironment(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironment.upsert(input);
  }
  updateProjectEnvironment(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironment.update(input);
  }
  findProjectEnvironmentServer(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironmentServer.findFirst(input);
  }
  findProjectEnvironmentServers(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironmentServer.findMany(input);
  }
  upsertProjectEnvironmentServer(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironmentServer.upsert(input);
  }
  deleteProjectEnvironmentServer(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).projectEnvironmentServer.delete(input);
  }
  findServer(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).server.findFirst(input);
  }
  findTeamCredential(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).teamCredential.findFirst(input);
  }
  findApplicationServices(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).applicationService.findMany(input);
  }
  createApplicationService(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).applicationService.create(input);
  }
  updateApplicationService(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).applicationService.update(input);
  }
  findManagedResources(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).managedResource.findMany(input);
  }
  createManagedResource(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).managedResource.create(input);
  }
  updateManagedResources(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).managedResource.updateMany(input);
  }
  findResourceInstances(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceInstance.findMany(input);
  }
  updateResourceInstances(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).resourceInstance.updateMany(input);
  }
  findDeploymentRuns(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).deploymentRun.findMany(input);
  }
  findSites(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).site.findMany(input);
  }
  createSite(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).site.create(input);
  }
  updateSites(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).site.updateMany(input);
  }
  findCDNConfigs(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).cDNConfig.findMany(input);
  }
  createCDNConfig(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).cDNConfig.create(input);
  }
  updateCDNConfigs(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).cDNConfig.updateMany(input);
  }
  findSecretKeys(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).secretKey.findMany(input);
  }
  createSecretKey(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).secretKey.create(input);
  }
  updateSecretKeys(input: Record<string, unknown>) {
    return (this.prisma as PrismaAny).secretKey.updateMany(input);
  }
}
