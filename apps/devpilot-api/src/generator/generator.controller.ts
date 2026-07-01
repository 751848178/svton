import { Controller, Post, Body, Res, UseGuards, Request, HttpCode, Get, Param, StreamableFile } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { createReadStream } from 'fs';
import { Response } from 'express';
import { ControlAccessPolicyService } from '../control-access-policy';
import { AuditEventService } from '../audit-event';
import { GeneratorService, type ProjectZipArtifactCleanupResult, type ResolvedProjectZipArtifact } from './generator.service';
import { CleanGeneratedProjectArtifactsDto, GenerateProjectDto } from './dto/generate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectService } from '../project/project.service';

interface GenerateProjectRequest {
  user: { id: string };
  teamId: string;
}

@Controller('projects')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class GeneratorController {
  constructor(
    private readonly generatorService: GeneratorService,
    private readonly projectService: ProjectService,
    private readonly accessPolicyService: ControlAccessPolicyService,
    private readonly auditEventService: AuditEventService,
  ) {}

  @Post('generate')
  async generateProject(
    @Body() dto: GenerateProjectDto,
    @Request() req: GenerateProjectRequest,
    @Res() res: Response,
  ) {
    await this.accessPolicyService.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'project',
      action: 'project.generate',
      targetType: 'project',
      risk: 'medium',
    });

    const project = await this.projectService.create(req.teamId, req.user.id, {
      name: dto.basicInfo.name,
      description: dto.basicInfo.description,
      config: dto,
    });

    const resourceResolution = await this.generatorService.resolveProjectResources(
      req.teamId,
      req.user.id,
      project.id,
      dto,
    );

    // 生成项目文件
    const files = await this.generatorService.generateProject(
      dto,
      resourceResolution.credentials,
    );

    // 创建 ZIP 文件
    const zipBuffer = await this.generatorService.createZipBuffer(files);
    const artifact = await this.generatorService.persistProjectZipArtifact(
      req.teamId,
      project.id,
      dto.basicInfo.name,
      zipBuffer,
    );
    const resolvedConfig = {
      ...dto,
      resolvedResources: resourceResolution.summary,
    };

    await this.projectService.attachGeneratedProjectArtifact(
      req.teamId,
      project.id,
      resolvedConfig,
      artifact,
    );

    // 返回 ZIP 文件
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
      'Content-Length': zipBuffer.length,
      'X-Project-Id': project.id,
      'X-Project-Download-Url': artifact.downloadUrl,
      'X-Project-Artifact-Expires-At': artifact.expiresAt,
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, X-Project-Id, X-Project-Download-Url, X-Project-Artifact-Expires-At',
    });

    res.send(zipBuffer);
  }

  @Post('artifacts/cleanup')
  @HttpCode(200)
  async cleanupGeneratedProjectArtifacts(
    @Body() dto: CleanGeneratedProjectArtifactsDto,
    @Request() req: GenerateProjectRequest,
  ) {
    const dryRun = dto.dryRun ?? true;
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: dto.projectId,
      category: 'project',
      action: 'project.artifact.cleanup',
      targetType: 'project_artifact',
      targetId: dto.projectId ?? 'generated-projects-local',
      risk: dryRun ? 'low' : 'high',
    });

    const result = await this.generatorService.cleanupExpiredProjectZipArtifacts({
      dryRun,
      teamId: req.teamId,
      projectId: dto.projectId,
    });

    await this.auditEventService.create({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: dto.projectId,
      category: 'project',
      action: 'project.artifact.cleanup',
      targetType: 'project_artifact',
      targetId: dto.projectId ?? 'generated-projects-local',
      risk: dryRun ? 'low' : 'high',
      status: 'completed',
      summary: dryRun
        ? `Dry-run found ${result.expired} expired generated project artifacts`
        : `Deleted ${result.deleted} expired generated project artifacts`,
      metadata: {
        dryRun,
        scanned: result.scanned,
        expired: result.expired,
        deleted: result.deleted,
        projectId: dto.projectId ?? null,
        artifacts: result.artifacts.slice(0, 20).map(artifact => ({
          teamId: artifact.teamId,
          projectId: artifact.projectId,
          fileName: artifact.fileName,
          size: artifact.size,
          generatedAt: artifact.generatedAt,
          expiresAt: artifact.expiresAt,
          deleted: artifact.deleted,
        })),
        artifactsTruncated: result.artifacts.length > 20,
      },
    });

    return this.toArtifactCleanupResponse(result);
  }

  @Get(':id/download')
  async downloadGeneratedProject(
    @Param('id') id: string,
    @Request() req: GenerateProjectRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const project = await this.projectService.findGeneratedArtifactProject(req.teamId, id);
    await this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: id,
      category: 'project',
      action: 'project.download',
      targetType: 'project_artifact',
      targetId: id,
      risk: 'low',
    });

    const artifact = await this.generatorService.resolveProjectZipArtifact(
      req.teamId,
      project.id,
      project.name,
      project.config,
    );
    const updatedProject = await this.projectService.recordGeneratedProjectArtifactDownload(
      req.teamId,
      project.id,
      req.user.id,
      artifact,
    );
    await this.auditEventService.create({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: project.id,
      category: 'project',
      action: 'project.artifact.download',
      targetType: 'project_artifact',
      targetId: project.id,
      risk: 'low',
      status: 'completed',
      summary: `Downloaded generated project artifact ${artifact.fileName}`,
      metadata: this.toArtifactDownloadAuditMetadata(artifact, updatedProject.config),
    });

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
      'Content-Length': artifact.size,
      'Cache-Control': 'private, no-store',
      'X-Project-Id': project.id,
      'X-Project-Download-Url': artifact.downloadUrl,
      'X-Project-Artifact-Expires-At': artifact.expiresAt,
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, X-Project-Id, X-Project-Download-Url, X-Project-Artifact-Expires-At',
    });

    return new StreamableFile(createReadStream(artifact.filePath));
  }

  @Post('preview')
  @HttpCode(200)
  async previewProject(
    @Body() dto: GenerateProjectDto,
    @Request() req: GenerateProjectRequest,
  ) {
    await this.accessPolicyService.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'project',
      action: 'project.preview',
      targetType: 'project_preview',
      risk: 'low',
    });

    const files = await this.generatorService.generateProject(dto);

    return {
      files: files.map(f => ({
        path: f.path,
        size: f.content.length,
        preview: f.content.slice(0, 500) + (f.content.length > 500 ? '...' : ''),
      })),
      totalFiles: files.length,
    };
  }

  private toArtifactCleanupResponse(result: ProjectZipArtifactCleanupResult) {
    return {
      dryRun: result.dryRun,
      scanned: result.scanned,
      expired: result.expired,
      deleted: result.deleted,
      artifacts: result.artifacts.map(artifact => ({
        teamId: artifact.teamId,
        projectId: artifact.projectId,
        fileName: artifact.fileName,
        size: artifact.size,
        generatedAt: artifact.generatedAt,
        expiresAt: artifact.expiresAt,
        deleted: artifact.deleted,
      })),
    };
  }

  private toArtifactDownloadAuditMetadata(
    artifact: ResolvedProjectZipArtifact,
    recordedProjectConfig: unknown,
  ) {
    const recordedArtifact = this.asRecord(this.asRecord(recordedProjectConfig)?.generatedArtifact);
    const recordedDownloadCount = recordedArtifact?.downloadCount;

    return {
      fileName: artifact.fileName,
      size: artifact.size,
      sha256: artifact.sha256,
      generatedAt: artifact.generatedAt,
      expiresAt: artifact.expiresAt,
      downloadCount: typeof recordedDownloadCount === 'number'
        ? recordedDownloadCount
        : artifact.downloadCount ?? 0,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  }
}
