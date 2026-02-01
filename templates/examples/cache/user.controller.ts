import { Controller, Get, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { UserService, User } from './user.service';

@Controller('examples/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    return this.userService.findOne(Number(id));
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ): Promise<User[]> {
    return this.userService.findAll(Number(page), Number(pageSize));
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Partial<User>,
  ): Promise<User> {
    return this.userService.update(Number(id), data);
  }

  @Put(':id/refresh')
  async updateAndRefresh(
    @Param('id') id: string,
    @Body() data: Partial<User>,
  ): Promise<User> {
    return this.userService.updateAndRefresh(Number(id), data);
  }

  @Delete('cache')
  async clearCache(): Promise<{ message: string }> {
    await this.userService.clearAllCache();
    return { message: 'Cache cleared successfully' };
  }
}
