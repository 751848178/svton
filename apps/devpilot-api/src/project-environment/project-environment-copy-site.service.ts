/**
 * Project-environment site-copy service.
 *
 * Owns `copySites` + its access-scope resolver: copies draft site skeletons
 * across environments with optional OpenResty dry-run/queued-live takeover.
 * Extracted from `ProjectEnvironmentService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { SiteService } from '../site';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { CopyProjectEnvironmentSitesDto } from './dto/project-environment.dto';
import {
  extractNestedString,
  extractString,
  isRecord,
  isSafeUpstreamUrl,
  sanitizeSiteTlsForCopy,
  toJsonValue,
} from './project-environment-helpers.utils';
import { buildSiteCopyQueuedLiveSyncFollowUp } from './project-environment-copy.utils';
import { buildSiteCopyAuditInput } from './project-environment-audit.utils';

@Injectable()
export class ProjectEnvironmentCopySiteService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
    @Optional() private readonly siteService: SiteService | null,
    @Optional() private readonly auditEventService: AuditEventService | null,
  ) {}

  async getSiteCopyAccessScope(teamId: string, dto: CopyProjectEnvironmentSitesDto) {
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    return { projectId: source.projectId, sourceEnvironmentId: source.id, targetEnvironmentId: target.id };
  }

  async copySites(teamId: string, userId: string, dto: CopyProjectEnvironmentSitesDto) {
    if (!dto.projectId || !dto.sourceEnvironmentId || !dto.targetEnvironmentId) throw new BadRequestException('projectId、sourceEnvironmentId 和 targetEnvironmentId 不能为空');
    const dryRun = dto.dryRun !== false;
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    if (source.id === target.id) throw new BadRequestException('源环境和目标环境不能相同');
    if (!dryRun && dto.confirmationText !== target.name && dto.confirmationText !== target.key) throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${target.name} / ${target.key}`);

    const sourceSites = await this.repo.findSites({ where: { teamId, projectId: dto.projectId, environmentId: source.id, ...(dto.siteIds?.length ? { id: { in: dto.siteIds } } : {}) }, select: { id: true, name: true, primaryDomain: true, aliases: true, runtimeType: true, runtimeConfig: true, tls: true, accessPolicy: true, status: true }, orderBy: [{ name: 'asc' }, { primaryDomain: 'asc' }] }) as any;
    const targetSites = await this.repo.findSites({ where: { teamId, projectId: dto.projectId, environmentId: target.id }, select: { id: true, primaryDomain: true } }) as any;
    const existingTargetDomains = new Set(targetSites.map((s: any) => s.primaryDomain));
    const targetDomainOverrides = dto.targetDomainOverrides || {};
    const openRestyTakeover = dto.openRestyTakeover === true;
    const createDryRunSyncPlan = openRestyTakeover && dto.createDryRunSyncPlan !== false;
    const createQueuedLiveSync = openRestyTakeover && !dryRun && dto.createQueuedLiveSync === true;
    const targetServerIds = dto.targetServerIds || {};
    const targetUpstreamUrls = dto.targetUpstreamUrls || {};
    const steps: any[] = [];
    if ((createDryRunSyncPlan || createQueuedLiveSync) && !this.siteService) throw new BadRequestException('Site copy OpenResty 接管执行治理需要 Site sync 服务');

    for (const site of sourceSites) {
      const targetDomain = targetDomainOverrides[site.id]?.trim();
      const targetServerId = targetServerIds[site.id]?.trim();
      const targetUpstreamUrl = targetUpstreamUrls[site.id]?.trim();
      const baseMetadata = { runtimeType: site.runtimeType, sourceDomain: site.primaryDomain, targetDomain: targetDomain || null, openRestyTakeover: openRestyTakeover ? { enabled: true, targetServerId: targetServerId || null, upstreamUrl: targetUpstreamUrl || null, createDryRunSyncPlan, createQueuedLiveSync } : undefined };
      if (!targetDomain) { steps.push({ status: 'skipped', sourceSiteId: site.id, title: `站点 ${site.name}`, description: '缺少目标域名，apply 时不会自动复制该站点', metadata: { ...baseMetadata, reason: 'missing_target_domain' } }); continue; }
      if (openRestyTakeover && !targetServerId) { steps.push({ status: 'skipped', sourceSiteId: site.id, title: `站点 ${site.name}`, description: '缺少目标服务器，无法生成 OpenResty 接管计划', metadata: { ...baseMetadata, reason: 'missing_target_server' } }); continue; }
      if (openRestyTakeover && !targetUpstreamUrl) { steps.push({ status: 'skipped', sourceSiteId: site.id, title: `站点 ${site.name}`, description: '缺少目标 upstream，无法生成 OpenResty 接管计划', metadata: { ...baseMetadata, reason: 'missing_target_upstream' } }); continue; }
      if (openRestyTakeover && targetUpstreamUrl && !isSafeUpstreamUrl(targetUpstreamUrl)) { steps.push({ status: 'skipped', sourceSiteId: site.id, title: `站点 ${site.name}`, description: '目标 upstream 包含不安全字符，无法生成 OpenResty 接管计划', metadata: { ...baseMetadata, reason: 'unsafe_target_upstream' } }); continue; }
      if (existingTargetDomains.has(targetDomain)) { steps.push({ status: 'skipped', sourceSiteId: site.id, title: `站点 ${site.name}`, description: `目标环境已存在域名 ${targetDomain}`, metadata: { ...baseMetadata, reason: 'target_domain_exists' } }); continue; }
      if (dryRun) { steps.push({ status: 'planned', sourceSiteId: site.id, title: `复制站点 ${site.name}`, description: openRestyTakeover ? `将以待同步站点复制到 ${target.name}，绑定目标服务器并生成 OpenResty dry-run 接管计划` : `将以 draft 站点复制到 ${target.name}，目标域名 ${targetDomain}`, metadata: baseMetadata }); continue; }
      if (openRestyTakeover && targetServerId) await this.assertServer(teamId, targetServerId);
      const runtimeConfig = isRecord(site.runtimeConfig) ? { ...site.runtimeConfig } : {};
      if (openRestyTakeover && targetUpstreamUrl) { runtimeConfig.upstreamUrl = targetUpstreamUrl; runtimeConfig.syncBlocked = false; delete runtimeConfig.syncBlockedReason; }
      const siteData: Prisma.SiteUncheckedCreateInput = { teamId, createdById: userId, projectId: dto.projectId, environmentId: target.id, name: `${site.name} (${target.name})`, primaryDomain: targetDomain, aliases: site.aliases ? toJsonValue(site.aliases) : undefined, runtimeType: site.runtimeType, runtimeConfig: Object.keys(runtimeConfig).length > 0 ? toJsonValue(runtimeConfig) : undefined, tls: toJsonValue(sanitizeSiteTlsForCopy(site.tls)), accessPolicy: site.accessPolicy ? toJsonValue(site.accessPolicy) : undefined, status: openRestyTakeover ? 'pending' : 'draft' } as any;
      if (openRestyTakeover) { (siteData as any).serverId = targetServerId; (siteData as any).syncError = null; }
      const created = await this.repo.createSite({ data: siteData, select: { id: true } });
      const syncPlan = createDryRunSyncPlan ? await this.siteService!.createSyncPlan(teamId, userId, created.id, { dryRun: true }) : null;
      const queuedLiveSync = createQueuedLiveSync ? await this.siteService!.createSyncPlan(teamId, userId, created.id, { dryRun: false, queue: true, maxAttempts: dto.queuedLiveSyncMaxAttempts, confirmationText: (dto.queuedLiveSyncConfirmationTexts || {})[site.id]?.trim() || undefined, approvalId: (dto.queuedLiveSyncApprovalIds || {})[site.id]?.trim() || undefined, approvalReason: (dto.queuedLiveSyncApprovalReasons || {})[site.id]?.trim() || undefined } as any) : null;
      existingTargetDomains.add(targetDomain);
      steps.push({ status: 'applied', sourceSiteId: site.id, targetSiteId: created.id, title: `复制站点 ${site.name}`, description: openRestyTakeover ? (createQueuedLiveSync ? (createDryRunSyncPlan ? `已创建目标环境待同步站点 ${targetDomain}，生成 OpenResty dry-run 接管计划并请求 queued live sync` : `已创建目标环境待同步站点 ${targetDomain} 并请求 queued live sync`) : (createDryRunSyncPlan ? `已创建目标环境待同步站点 ${targetDomain} 并生成 OpenResty dry-run 接管计划` : `已创建目标环境待同步站点 ${targetDomain}`)) : `已创建目标环境 draft 站点 ${targetDomain}`, metadata: { ...baseMetadata, openRestyTakeover: openRestyTakeover ? { enabled: true, targetServerId, upstreamUrl: targetUpstreamUrl, createDryRunSyncPlan, syncRunId: extractNestedString(syncPlan, ['syncRun', 'id']), syncStatus: extractString(syncPlan, 'status'), queuedLiveSync: createQueuedLiveSync ? { enabled: true, syncRunId: extractNestedString(queuedLiveSync, ['syncRun', 'id']), syncStatus: extractString(queuedLiveSync, 'status'), serverExecutionJobId: extractNestedString(queuedLiveSync, ['syncRun', 'serverExecutionJobId']) || extractNestedString(queuedLiveSync, ['syncRun', 'serverExecutionJob', 'id']), approvalId: extractNestedString(queuedLiveSync, ['approval', 'id']) || extractNestedString(queuedLiveSync, ['syncRun', 'operationApprovalId']) || extractNestedString(queuedLiveSync, ['syncRun', 'operationApproval', 'id']), approvalStatus: extractNestedString(queuedLiveSync, ['approval', 'status']) || extractNestedString(queuedLiveSync, ['syncRun', 'operationApproval', 'status']), maxAttempts: dto.queuedLiveSyncMaxAttempts ?? null, confirmationTextProvided: Boolean((dto.queuedLiveSyncConfirmationTexts || {})[site.id]?.trim()) } : undefined } : undefined } });
    }

    const result = { projectId: dto.projectId, sourceEnvironment: { id: source.id, key: source.key, name: source.name }, targetEnvironment: { id: target.id, key: target.key, name: target.name }, dryRun, status: dryRun ? 'planned' : 'completed', plannedCount: steps.filter((s) => s.status === 'planned').length, appliedCount: steps.filter((s) => s.status === 'applied').length, skippedCount: steps.filter((s) => s.status === 'skipped').length, steps, followUp: { queuedLiveSync: buildSiteCopyQueuedLiveSyncFollowUp(steps) }, warnings: [openRestyTakeover ? (createQueuedLiveSync ? 'OpenResty 接管会请求 queued live sync；没有已批准审批时只生成 blocked approval，不在 copy 请求内执行 live 写入。' : createDryRunSyncPlan ? 'OpenResty 接管只生成 dry-run 同步计划，不执行 live Nginx/OpenResty 写入。' : 'OpenResty 接管只绑定目标服务器和 upstream，不执行 live Nginx/OpenResty 写入。') : '只复制 Site 配置骨架并创建 draft 站点，不执行 Nginx/OpenResty 同步。', '不会复制 serverId、proxyConfigId、证书观测资产、续期状态或真实 TLS 证书内容。', '非 dry-run 时每个待复制站点必须显式提供目标域名。'] };
    await this.auditEventService?.create(buildSiteCopyAuditInput(teamId, userId, result) as any);
    return result;
  }

  private async resolveProjectEnvironment(teamId: string, projectId: string, environmentId: string) {
    const env = await this.repo.findProjectEnvironment({ where: { id: environmentId, teamId, projectId, status: 'active' }, select: { id: true, projectId: true, key: true, name: true, status: true } });
    if (!env) throw new NotFoundException('项目环境不存在或不可用');
    return env;
  }

  private async assertServer(teamId: string, serverId: string) {
    const server = await this.repo.findServer({ where: { id: serverId, teamId }, select: { id: true } });
    if (!server) throw new NotFoundException('服务器不存在或不属于当前团队');
    return server;
  }
}
