import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamGuard } from '../team/guards/team.guard';
import { KeyCenterService } from './key-center.service';
import { GenerateKeyDto, StoreKeyDto } from './dto/key-center.dto';

interface AuthRequest {
  user: { sub: string };
  teamId: string;
}

@Controller('keys')
@UseGuards(JwtAuthGuard, TeamGuard)
export class KeyCenterController {
  constructor(private readonly keyCenterService: KeyCenterService) {}

  // 生成密钥（不存储）
  @Post('generate')
  generateKey(@Body() dto: GenerateKeyDto) {
    return this.keyCenterService.generateKey(dto);
  }

  // 存储密钥
  @Post()
  storeKey(@Body() dto: StoreKeyDto, @Request() req: AuthRequest) {
    return this.keyCenterService.storeKey(req.teamId, req.user.sub, dto);
  }

  // 获取团队的所有密钥
  @Get()
  getKeys(
    @Request() req: AuthRequest,
    @Query('projectId') projectId?: string,
  ) {
    return this.keyCenterService.getKeys(req.teamId, projectId);
  }

  // 获取密钥值
  @Get(':id/value')
  getKeyValue(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    return this.keyCenterService.getKeyValue(req.teamId, id);
  }

  // 更新密钥
  @Put(':id')
  updateKey(
    @Param('id') id: string,
    @Body() dto: Partial<StoreKeyDto>,
    @Request() req: AuthRequest,
  ) {
    return this.keyCenterService.updateKey(req.teamId, id, dto);
  }

  // 删除密钥
  @Delete(':id')
  deleteKey(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    return this.keyCenterService.deleteKey(req.teamId, id);
  }

  // 批量生成项目密钥
  @Post('project/:projectId/generate')
  generateProjectKeys(
    @Param('projectId') projectId: string,
    @Body() body: { projectName: string },
    @Request() req: AuthRequest,
  ) {
    return this.keyCenterService.generateProjectKeys(
      req.teamId,
      req.user.sub,
      projectId,
      body.projectName,
    );
  }

  // 导出项目密钥为 .env 格式
  @Get('project/:projectId/export')
  exportAsEnv(
    @Param('projectId') projectId: string,
    @Request() req: AuthRequest,
  ) {
    return this.keyCenterService.exportAsEnv(req.teamId, projectId);
  }
}
