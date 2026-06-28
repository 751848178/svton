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
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { KeyCenterService } from './key-center.service';
import { GenerateKeyDto, StoreKeyDto } from './dto/key-center.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('keys')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class KeyCenterController {
  constructor(
    private readonly keyCenterService: KeyCenterService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  // 生成密钥（不存储）
  @Post('generate')
  generateKey(@Body() dto: GenerateKeyDto) {
    return this.keyCenterService.generateKey(dto);
  }

  // 存储密钥
  @Post()
  async storeKey(@Body() dto: StoreKeyDto, @Request() req: AuthRequest) {
    const scope = await this.keyCenterService.resolveKeyInputAccessScope(req.teamId, dto);
    await this.assertCanSelfServiceKey(req, 'secret_key.create', null, scope.projectId, scope.environmentId, 'medium');
    return this.keyCenterService.storeKey(req.teamId, req.user.id, dto);
  }

  // 获取团队的所有密钥
  @Get()
  async getKeys(
    @Request() req: AuthRequest,
    @Query('projectId') projectId?: string,
    @Query('environmentId') environmentId?: string,
  ) {
    const keys = await this.keyCenterService.getKeys(req.teamId, projectId, environmentId);
    const allowed = await Promise.all(
      keys.map(async (key) => ({
        key,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: key.projectId,
          environmentId: key.environmentId,
          category: 'secret_key',
          action: 'secret_key.read',
          targetType: 'secret_key',
          targetId: key.id,
          risk: 'low',
        }),
      })),
    );
    return allowed.filter((item) => item.allowed).map((item) => item.key);
  }

  // 获取密钥值
  @Get(':id/value')
  async getKeyValue(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.keyCenterService.getKeyAccessScope(req.teamId, id);
    await this.assertCanSensitiveReadKey(req, 'secret_key.value.read', id, scope.projectId, scope.environmentId);
    return this.keyCenterService.getKeyValue(req.teamId, id);
  }

  // 更新密钥
  @Put(':id')
  async updateKey(
    @Param('id') id: string,
    @Body() dto: Partial<StoreKeyDto>,
    @Request() req: AuthRequest,
  ) {
    const currentScope = await this.keyCenterService.getKeyAccessScope(req.teamId, id);
    await this.assertCanSelfServiceKey(
      req,
      'secret_key.update',
      id,
      currentScope.projectId,
      currentScope.environmentId,
      'medium',
    );
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const targetScope = await this.keyCenterService.resolveKeyInputAccessScope(req.teamId, dto);
      if (
        targetScope.projectId !== currentScope.projectId ||
        targetScope.environmentId !== currentScope.environmentId
      ) {
        await this.assertCanSelfServiceKey(
          req,
          'secret_key.update',
          id,
          targetScope.projectId,
          targetScope.environmentId,
          'medium',
        );
      }
    }
    return this.keyCenterService.updateKey(req.teamId, id, dto);
  }

  // 删除密钥
  @Delete(':id')
  async deleteKey(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.keyCenterService.getKeyAccessScope(req.teamId, id);
    await this.assertCanSelfServiceKey(req, 'secret_key.delete', id, scope.projectId, scope.environmentId, 'high');
    return this.keyCenterService.deleteKey(req.teamId, id);
  }

  // 批量生成项目密钥
  @Post('project/:projectId/generate')
  async generateProjectKeys(
    @Param('projectId') projectId: string,
    @Body() body: { projectName: string },
    @Request() req: AuthRequest,
  ) {
    const scope = await this.keyCenterService.resolveKeyInputAccessScope(req.teamId, { projectId });
    await this.assertCanSelfServiceKey(
      req,
      'secret_key.generate_project',
      projectId,
      scope.projectId,
      scope.environmentId,
      'medium',
    );
    return this.keyCenterService.generateProjectKeys(
      req.teamId,
      req.user.id,
      projectId,
      body.projectName,
    );
  }

  // 导出项目密钥为 .env 格式
  @Get('project/:projectId/export')
  async exportAsEnv(
    @Param('projectId') projectId: string,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.keyCenterService.resolveKeyInputAccessScope(req.teamId, { projectId });
    const keys = await this.keyCenterService.listKeyScopes(req.teamId, scope.projectId || projectId);
    const allowed = await Promise.all(
      keys.map(async (key) => ({
        key,
        allowed: await this.accessPolicyService.canSensitiveRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: key.projectId,
          environmentId: key.environmentId,
          category: 'secret_key',
          action: 'secret_key.export',
          targetType: 'secret_key',
          targetId: key.id,
          risk: 'high',
        }),
      })),
    );
    return this.keyCenterService.exportAsEnv(
      req.teamId,
      scope.projectId || projectId,
      allowed.filter((item) => item.allowed).map((item) => item.key.id),
    );
  }

  private assertCanSensitiveReadKey(
    req: AuthRequest,
    action: string,
    keyId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
  ) {
    return this.accessPolicyService.assertCanSensitiveRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'secret_key',
      action,
      targetType: 'secret_key',
      targetId: keyId,
      risk: 'high',
    });
  }

  private assertCanSelfServiceKey(
    req: AuthRequest,
    action: string,
    keyId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'secret_key',
      action,
      targetType: 'secret_key',
      targetId: keyId,
      risk,
    });
  }
}
