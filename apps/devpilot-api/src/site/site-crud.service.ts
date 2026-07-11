import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateSiteDto,
  ListSiteSyncRunsQueryDto,
  ListSitesQueryDto,
  UpdateSiteDto,
} from "./dto/site.dto";
import { SiteBindingService } from "./site-binding.service";
import { SITE_INCLUDE, SYNC_RUN_INCLUDE } from "./site-includes.utils";

type SiteTakeoverUpdateInput = {
  tls?: unknown;
  accessPolicy?: unknown;
};

export class SiteCrudService {
  private readonly bindingService: SiteBindingService;

  constructor(private readonly prisma: PrismaService) {
    this.bindingService = new SiteBindingService(prisma);
  }

  async listSites(teamId: string, query: ListSitesQueryDto) {
    const where: Prisma.SiteWhereInput = { teamId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.serverId) where.serverId = query.serverId;
    if (query.status) where.status = query.status;

    return this.prisma.site.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: SITE_INCLUDE,
    });
  }

  async createSite(teamId: string, userId: string, dto: CreateSiteDto) {
    await this.assertBindings(teamId, dto);

    return this.prisma.site.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        primaryDomain: dto.primaryDomain,
        aliases: dto.aliases
          ? this.toJsonValue(this.cleanAliases(dto.aliases))
          : undefined,
        runtimeType: dto.runtimeType || "reverse_proxy",
        runtimeConfig: dto.runtimeConfig
          ? this.toJsonValue(dto.runtimeConfig)
          : undefined,
        tls: dto.tls ? this.toJsonValue(dto.tls) : undefined,
        accessPolicy: dto.accessPolicy
          ? this.toJsonValue(dto.accessPolicy)
          : undefined,
        projectId: dto.projectId,
        environmentId: dto.environmentId,
        serverId: dto.serverId,
        proxyConfigId: dto.proxyConfigId,
        status: "draft",
      },
      include: SITE_INCLUDE,
    });
  }

  async getSite(teamId: string, id: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, teamId },
      include: SITE_INCLUDE,
    });
    if (!site) throw new NotFoundException("站点不存在");
    return site;
  }

  async listSyncRuns(
    teamId: string,
    id: string,
    query: ListSiteSyncRunsQueryDto,
  ) {
    await this.getSite(teamId, id);

    const where: Prisma.SiteSyncRunWhereInput = { teamId, siteId: id };
    if (query.mode) where.mode = query.mode;
    if (query.status) where.status = query.status;

    return this.prisma.siteSyncRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 20,
      include: SYNC_RUN_INCLUDE,
    });
  }

  async updateSite(teamId: string, id: string, dto: UpdateSiteDto) {
    const existing = await this.getSite(teamId, id);
    await this.assertBindings(teamId, dto, existing.projectId);

    return this.prisma.site.update({
      where: { id },
      data: this.toUpdateData(dto),
      include: SITE_INCLUDE,
    });
  }

  async updateTakeoverSite(
    id: string,
    serverId: string,
    runtimeConfig: unknown,
    dto: SiteTakeoverUpdateInput,
  ) {
    const data: Prisma.SiteUncheckedUpdateInput = {
      serverId,
      runtimeType: "reverse_proxy",
      runtimeConfig: this.toJsonValue(runtimeConfig),
      status: "pending",
      syncError: null,
    };
    if (dto.tls !== undefined) data.tls = this.toJsonValue(dto.tls);
    if (dto.accessPolicy !== undefined) {
      data.accessPolicy = this.toJsonValue(dto.accessPolicy);
    }
    return this.prisma.site.update({
      where: { id },
      data,
      include: SITE_INCLUDE,
    });
  }

  async deleteSite(teamId: string, id: string) {
    await this.getSite(teamId, id);
    await this.prisma.site.delete({ where: { id } });
    return { success: true };
  }

  async assertBindings(
    teamId: string,
    dto: Parameters<SiteBindingService["assertBindings"]>[1],
    fallbackProjectId?: string | null,
  ) {
    return this.bindingService.assertBindings(teamId, dto, fallbackProjectId);
  }

  private toUpdateData(dto: UpdateSiteDto): Prisma.SiteUncheckedUpdateInput {
    const data: Prisma.SiteUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.primaryDomain !== undefined) data.primaryDomain = dto.primaryDomain;
    if (dto.aliases !== undefined) {
      data.aliases = this.toJsonValue(this.cleanAliases(dto.aliases));
    }
    if (dto.runtimeType !== undefined) data.runtimeType = dto.runtimeType;
    if (dto.runtimeConfig !== undefined)
      data.runtimeConfig = this.toJsonValue(dto.runtimeConfig);
    if (dto.tls !== undefined) data.tls = this.toJsonValue(dto.tls);
    if (dto.accessPolicy !== undefined)
      data.accessPolicy = this.toJsonValue(dto.accessPolicy);
    if (dto.projectId !== undefined) data.projectId = dto.projectId || null;
    if (dto.environmentId !== undefined)
      data.environmentId = dto.environmentId || null;
    if (dto.serverId !== undefined) data.serverId = dto.serverId || null;
    if (dto.proxyConfigId !== undefined)
      data.proxyConfigId = dto.proxyConfigId || null;
    data.status = dto.status || "pending";
    return data;
  }

  private cleanAliases(aliases: string[]) {
    return aliases.map((alias) => alias.trim()).filter(Boolean);
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
