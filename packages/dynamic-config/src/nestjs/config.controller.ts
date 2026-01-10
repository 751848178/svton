import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { DynamicConfigService } from './config.service';

/**
 * 基础配置 Controller
 * 不包含任何权限控制，用户可以继承并添加自己的 Guard
 *
 * @example
 * ```typescript
 * // 用户项目中
 * @Controller('config')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * export class ConfigController extends BaseConfigController {
 *   constructor(configService: DynamicConfigService) {
 *     super(configService);
 *   }
 *
 *   @Public()
 *   @Get('public')
 *   async getPublicConfigs() {
 *     return super.getPublicConfigs();
 *   }
 *
 *   @Roles('admin')
 *   @Delete(':key')
 *   async delete(@Param('key') key: string) {
 *     return super.delete(key);
 *   }
 * }
 * ```
 */
@Controller('config')
export class BaseConfigController {
  constructor(protected readonly configService: DynamicConfigService) {}

  /**
   * 获取公开配置
   */
  @Get('public')
  async getPublicConfigs() {
    return this.configService.getPublicConfigs();
  }

  /**
   * 获取系统配置（嵌套结构）
   */
  @Get('system')
  async getSystemConfig() {
    return this.configService.getSystemConfig();
  }

  /**
   * 获取分类配置
   */
  @Get('category/:category')
  async getByCategory(@Param('category') category: string) {
    return this.configService.getByCategory(category);
  }

  /**
   * 获取单个配置
   */
  @Get(':key')
  async get(@Param('key') key: string) {
    return this.configService.get(key);
  }

  /**
   * 设置配置
   */
  @Post()
  async set(@Body() body: { key: string; value: any }) {
    await this.configService.set(body.key, body.value);
    return { success: true, message: 'Config updated' };
  }

  /**
   * 批量更新配置
   */
  @Put('batch')
  async batchUpdate(@Body() body: { configs: Array<{ key: string; value: any }> }) {
    await this.configService.batchUpdate(body.configs);
    return { success: true, message: 'Configs batch updated' };
  }

  /**
   * 删除配置
   */
  @Delete(':key')
  async delete(@Param('key') key: string) {
    await this.configService.delete(key);
    return { success: true, message: 'Config deleted' };
  }

  /**
   * 重新加载配置
   */
  @Post('reload')
  async reload() {
    await this.configService.reload();
    return { success: true, message: 'Configs reloaded' };
  }
}
