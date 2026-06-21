import { Controller, Post, Body, Res, UseGuards, Request, HttpCode } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { Response } from 'express';
import { GeneratorService } from './generator.service';
import { GenerateProjectDto } from './dto/generate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectService } from '../project/project.service';

interface GenerateProjectRequest {
  user: { id: string };
  teamId: string;
}

@Controller('projects')
export class GeneratorController {
  constructor(
    private readonly generatorService: GeneratorService,
    private readonly projectService: ProjectService,
  ) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard, AuthzGuard)
  @Roles('team_member')
  async generateProject(
    @Body() dto: GenerateProjectDto,
    @Request() req: GenerateProjectRequest,
    @Res() res: Response,
  ) {
    // 生成项目文件
    const files = await this.generatorService.generateProject(dto);
    const project = await this.projectService.create(req.teamId, req.user.id, {
      name: dto.basicInfo.name,
      description: dto.basicInfo.description,
      config: dto,
    });

    // 创建 ZIP 文件
    const zipBuffer = await this.generatorService.createZipBuffer(files);

    // 返回 ZIP 文件
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${dto.basicInfo.name}.zip"`,
      'Content-Length': zipBuffer.length,
      'X-Project-Id': project.id,
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, X-Project-Id',
    });

    res.send(zipBuffer);
  }

  @Post('preview')
  @HttpCode(200)
  async previewProject(@Body() dto: GenerateProjectDto) {
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
