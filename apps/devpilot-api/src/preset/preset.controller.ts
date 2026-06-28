import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { ControlAccessPolicyService } from '../control-access-policy';
import { PresetService } from './preset.service';
import { CreatePresetDto, UpdatePresetDto, ImportPresetDto } from './dto/preset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('presets')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class PresetController {
  constructor(
    private readonly presetService: PresetService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post()
  async create(
    @Request() req: AuthRequest,
    @Body() dto: CreatePresetDto,
  ) {
    await this.assertCanWritePreset(req, 'preset.create', null, 'low');
    return this.presetService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.presetService.findAll(req.teamId);
  }

  @Get(':id')
  findOne(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.presetService.findOne(req.teamId, id);
  }

  @Put(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePresetDto,
  ) {
    await this.assertCanWritePreset(req, 'preset.update', id, 'low');
    return this.presetService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    await this.assertCanWritePreset(req, 'preset.delete', id, 'medium');
    return this.presetService.remove(req.teamId, id);
  }

  @Get(':id/export')
  exportPreset(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.presetService.exportPreset(req.teamId, id);
  }

  @Post('import')
  async importPreset(
    @Request() req: AuthRequest,
    @Body() dto: ImportPresetDto,
  ) {
    await this.assertCanWritePreset(req, 'preset.import', null, 'low');
    return this.presetService.importPreset(req.teamId, req.user.id, dto);
  }

  private assertCanWritePreset(
    req: AuthRequest,
    action: string,
    targetId: string | null,
    risk: 'low' | 'medium',
  ) {
    return this.accessPolicyService.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'preset',
      action,
      targetType: 'preset',
      targetId,
      risk,
    });
  }
}
