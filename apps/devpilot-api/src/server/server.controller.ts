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
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServerService } from './server.service';
import { CreateServerDto, UpdateServerDto } from './dto/server.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('servers')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  @Post()
  @Roles('team_admin')
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
  @Roles('team_admin')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateServerDto,
  ) {
    return this.serverService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  @Roles('team_admin')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.serverService.remove(req.teamId, id);
  }

  @Post(':id/test')
  testConnection(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.serverService.testConnection(req.teamId, id);
  }

  @Post(':id/detect')
  @Roles('team_admin')
  detectServices(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.serverService.detectServices(req.teamId, id);
  }
}
