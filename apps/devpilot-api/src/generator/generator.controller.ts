import { Controller, Post, Body, Res, UseGuards, Request, HttpCode, Get, Param, StreamableFile } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { createReadStream } from 'fs';
import { Response } from 'express';
import { ControlAccessPolicyService } from '../control-access-policy';
import { GeneratorService } from './generator.service';
import { GenerateProjectDto } from './dto/generate.dto';
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
    await this.projectService.recordGeneratedProjectArtifactDownload(
      req.teamId,
      project.id,
      req.user.id,
      artifact,
    );

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
}
