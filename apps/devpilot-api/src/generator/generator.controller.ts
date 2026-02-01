import { Controller, Post, Body, Res, UseGuards, Request, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { GeneratorService } from './generator.service';
import { GenerateProjectDto } from './dto/generate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('projects')
export class GeneratorController {
  constructor(private readonly generatorService: GeneratorService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  async generateProject(
    @Body() dto: GenerateProjectDto,
    @Request() req: { user: { id: string } },
    @Res() res: Response,
  ) {
    // 生成项目文件
    const files = await this.generatorService.generateProject(dto);

    // 创建 ZIP 文件
    const zipBuffer = await this.generatorService.createZipBuffer(files);

    // 返回 ZIP 文件
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${dto.basicInfo.name}.zip"`,
      'Content-Length': zipBuffer.length,
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
