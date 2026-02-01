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
import { TeamService } from './team.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  MemberRole,
} from './dto/team.dto';

interface RequestWithUser {
  user: { id: string; email: string };
}

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // 创建团队
  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateTeamDto) {
    return this.teamService.create(req.user.id, dto);
  }

  // 获取用户的所有团队
  @Get()
  findAll(@Request() req: RequestWithUser) {
    return this.teamService.findByUser(req.user.id);
  }

  // 获取团队详情
  @Get(':id')
  findOne(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.teamService.findOne(id, req.user.id);
  }

  // 更新团队
  @Put(':id')
  update(@Request() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamService.update(id, req.user.id, dto);
  }

  // 删除团队
  @Delete(':id')
  remove(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.teamService.remove(id, req.user.id);
  }

  // 添加成员
  @Post(':id/members')
  addMember(@Request() req: RequestWithUser, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.teamService.addMember(id, req.user.id, dto.email, dto.role || MemberRole.MEMBER);
  }

  // 移除成员
  @Delete(':id/members/:memberId')
  removeMember(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamService.removeMember(id, req.user.id, memberId);
  }

  // 更新成员角色
  @Put(':id/members/:memberId/role')
  updateMemberRole(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamService.updateMemberRole(id, req.user.id, memberId, dto.role);
  }
}
