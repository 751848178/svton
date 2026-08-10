import { Controller, Post, Body, Res, UseGuards, Request, HttpCode, Get, Param, StreamableFile } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { createReadStream } from 'fs';
import { Response } from 'express';
import { ControlAccessPolicyService } from '../control-access-policy';
import { AuditEventService } from '../audit-event';
import { GeneratorService, type ResolvedProjectZipArtifact } from './generator.service';
import { GenerateProjectDto } from './dto/generate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectService } from '../project/project.service';
import type { GenerateProjectRequest } from './generator-request.types';

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
