import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from './control-access-policy.service';
import {
  CreateControlAccessPolicyDto,
  ListControlAccessPoliciesQueryDto,
  UpdateControlAccessPolicyDto,
} from './dto/control-access-policy.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('control-access-policies')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ControlAccessPolicyController {
  constructor(private readonly accessPolicyService: ControlAccessPolicyService) {}

  @Get()
  list(
    @Request() req: AuthRequest,
    @Query() query: ListControlAccessPoliciesQueryDto,
  ) {
    return this.accessPolicyService.list(req.teamId, query);
  }

  @Post()
  @Roles('team_admin')
  create(@Request() req: AuthRequest, @Body() dto: CreateControlAccessPolicyDto) {
    return this.accessPolicyService.create(req.teamId, req.user.id, dto);
  }

  @Patch(':id')
  @Roles('team_admin')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateControlAccessPolicyDto,
  ) {
    return this.accessPolicyService.update(req.teamId, req.user.id, id, dto);
  }

  @Delete(':id')
  @Roles('team_admin')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.accessPolicyService.delete(req.teamId, req.user.id, id);
  }
}
