import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '@svton/nestjs-authz';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Put('users/:id/role')
  updateUserRole(
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.adminService.updateUserRole(id, role);
  }

  @Get('resource-pools')
  getResourcePools() {
    return this.adminService.getResourcePools();
  }

  @Post('resource-pools')
  createResourcePool(
    @Body() data: {
      type: string;
      name: string;
      endpoint: string;
      adminConfig: string;
      capacity: number;
    },
  ) {
    return this.adminService.createResourcePool(data);
  }

  @Put('resource-pools/:id/status')
  updateResourcePoolStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateResourcePoolStatus(id, status);
  }
}
