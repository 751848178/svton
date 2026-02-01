import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamGuard, TeamRoles } from '../team/guards/team.guard';
import { ServerService } from './server.service';
import { CreateServerDto, UpdateServerDto } from './dto/server.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('servers')
@UseGuards(JwtAuthGuard, TeamGuard)
export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  @Post()
  @TeamRoles('owner', 'admin')
  create(@Request() req: AuthRequest, @Body() dto: CreateServerDto) {
    return this.serverService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.serverService.findAll(req.teamId);
  }

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.serverService.findOne(req.teamId, id);
  }

  @Put(':id')
  @TeamRoles('owner', 'admin')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateServerDto,
  ) {
    return this.serverService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  @TeamRoles('owner', 'admin')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.serverService.remove(req.teamId, id);
  }

  @Post(':id/test')
  testConnection(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.serverService.testConnection(req.teamId, id);
  }

  @Post(':id/detect')
  @TeamRoles('owner', 'admin')
  detectServices(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.serverService.detectServices(req.teamId, id);
  }
}
