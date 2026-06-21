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
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { ResourcePoolService } from './resource-pool.service';
import {
  CreateResourcePoolDto,
  UpdateResourcePoolDto,
  AllocateResourceDto,
} from './dto/resource-pool.dto';

@Controller('resource-pools')
@UseGuards(JwtAuthGuard)
export class ResourcePoolController {
  constructor(private readonly resourcePoolService: ResourcePoolService) {}

  // 管理员：创建资源池
  @Post()
  @UseGuards(AuthzGuard)
  @Roles('admin')
  async createPool(@Body() dto: CreateResourcePoolDto) {
    return this.resourcePoolService.createPool(dto);
  }

  // 管理员：获取所有资源池
  @Get()
  @UseGuards(AuthzGuard)
  @Roles('admin')
  async getPools(@Query('type') type?: string) {
    return this.resourcePoolService.getPools(type);
  }

  // 管理员：获取资源池详情
  @Get(':id')
  @UseGuards(AuthzGuard)
  @Roles('admin')
  async getPool(@Param('id') id: string) {
    return this.resourcePoolService.getPool(id);
  }

  // 管理员：更新资源池
  @Put(':id')
  @UseGuards(AuthzGuard)
  @Roles('admin')
  async updatePool(@Param('id') id: string, @Body() dto: UpdateResourcePoolDto) {
    return this.resourcePoolService.updatePool(id, dto);
  }

  // 管理员：删除资源池
  @Delete(':id')
  @UseGuards(AuthzGuard)
  @Roles('admin')
  async deletePool(@Param('id') id: string) {
    return this.resourcePoolService.deletePool(id);
  }

  // 用户：分配资源
  @Post('allocate')
  @UseGuards(AuthzGuard)
  @Roles('team_member')
  async allocateResource(
    @Body() dto: AllocateResourceDto,
    @Request() req: { user: { id: string }; teamId: string },
  ) {
    return this.resourcePoolService.allocateResource(dto, req.user.id, req.teamId);
  }

  // 用户：释放资源
  @Post('release/:allocationId')
  @UseGuards(AuthzGuard)
  @Roles('team_member')
  async releaseResource(
    @Param('allocationId') allocationId: string,
    @Request() req: { teamId: string },
  ) {
    return this.resourcePoolService.releaseResource(req.teamId, allocationId);
  }

  // 用户：获取我的资源分配
  @Get('my/allocations')
  async getMyAllocations(@Request() req: { user: { id: string } }) {
    return this.resourcePoolService.getUserAllocations(req.user.id);
  }

  // 用户：获取项目的资源分配
  @Get('project/:projectId/allocations')
  @UseGuards(AuthzGuard)
  @Roles('team_member')
  async getProjectAllocations(
    @Param('projectId') projectId: string,
    @Request() req: { teamId: string },
  ) {
    return this.resourcePoolService.getProjectAllocations(req.teamId, projectId);
  }
}
