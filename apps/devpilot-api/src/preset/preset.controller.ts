import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Headers } from '@nestjs/common';
import { PresetService } from './preset.service';
import { CreatePresetDto, UpdatePresetDto, ImportPresetDto } from './dto/preset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamGuard } from '../team/guards/team.guard';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('presets')
@UseGuards(JwtAuthGuard, TeamGuard)
export class PresetController {
  constructor(private readonly presetService: PresetService) {}

  @Post()
  create(
    @Request() req: AuthRequest,
    @Body() dto: CreatePresetDto,
  ) {
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
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePresetDto,
  ) {
    return this.presetService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  remove(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
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
  importPreset(
    @Request() req: AuthRequest,
    @Body() dto: ImportPresetDto,
  ) {
    return this.presetService.importPreset(req.teamId, req.user.id, dto);
  }
}
