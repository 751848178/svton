import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Roles, Permissions, RolesGuard } from '@svton/nestjs-authz';

@Controller('examples/users')
@UseGuards(RolesGuard)
export class UserController {
  /**
   * 查看用户列表 - 需要 admin 或 manager 角色
   */
  @Get()
  @Roles('admin', 'manager')
  findAll() {
    return {
      message: 'User list',
      users: [
        { id: 1, name: 'User 1', role: 'admin' },
        { id: 2, name: 'User 2', role: 'user' },
      ],
    };
  }

  /**
   * 查看用户详情 - 所有登录用户都可以
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return {
      message: 'User detail',
      user: { id, name: `User ${id}`, role: 'user' },
    };
  }

  /**
   * 创建用户 - 需要 admin 角色
   */
  @Post()
  @Roles('admin')
  create(@Body() data: any) {
    return {
      message: 'User created',
      user: { id: 3, ...data },
    };
  }

  /**
   * 更新用户 - 需要 user:update 权限
   */
  @Put(':id')
  @Permissions('user:update')
  update(@Param('id') id: string, @Body() data: any) {
    return {
      message: 'User updated',
      user: { id, ...data },
    };
  }

  /**
   * 删除用户 - 需要 admin 角色和 user:delete 权限
   */
  @Delete(':id')
  @Roles('admin')
  @Permissions('user:delete')
  delete(@Param('id') id: string) {
    return {
      message: 'User deleted',
      userId: id,
    };
  }

  /**
   * 批量删除 - 需要 admin 角色和 user:batch-delete 权限
   */
  @Delete()
  @Roles('admin')
  @Permissions('user:batch-delete')
  batchDelete(@Body() data: { ids: string[] }) {
    return {
      message: 'Users deleted',
      count: data.ids.length,
    };
  }

  /**
   * 导出用户 - 需要 admin 或 manager 角色
   */
  @Get('export')
  @Roles('admin', 'manager')
  export() {
    return {
      message: 'Export users',
      url: 'https://example.com/users.xlsx',
    };
  }

  /**
   * 重置密码 - 需要 user:reset-password 权限
   */
  @Post(':id/reset-password')
  @Permissions('user:reset-password')
  resetPassword(@Param('id') id: string) {
    return {
      message: 'Password reset',
      userId: id,
      newPassword: 'temp123456',
    };
  }
}
