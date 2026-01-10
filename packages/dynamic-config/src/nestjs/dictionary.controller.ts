import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { DynamicDictionaryService } from './dictionary.service';
import type { CreateDictionaryInput, UpdateDictionaryInput } from '../core/types';

/**
 * 基础字典 Controller
 * 不包含任何权限控制，用户可以继承并添加自己的 Guard
 *
 * @example
 * ```typescript
 * // 用户项目中
 * @Controller('dictionary')
 * export class DictionaryController extends BaseDictionaryController {
 *   constructor(dictionaryService: DynamicDictionaryService) {
 *     super(dictionaryService);
 *   }
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin')
 *   @Post()
 *   async create(@Body() data: CreateDictionaryInput) {
 *     return super.create(data);
 *   }
 * }
 * ```
 */
@Controller('dictionary')
export class BaseDictionaryController {
  constructor(protected readonly dictionaryService: DynamicDictionaryService) {}

  /**
   * 获取所有字典
   */
  @Get()
  async findAll() {
    return this.dictionaryService.findAll();
  }

  /**
   * 根据编码获取字典
   */
  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return this.dictionaryService.findByCode(code);
  }

  /**
   * 获取字典树
   */
  @Get('tree/:code')
  async getTree(@Param('code') code: string) {
    return this.dictionaryService.getTree(code);
  }

  /**
   * 获取字典详情
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.dictionaryService.findById(Number(id));
  }

  /**
   * 创建字典
   */
  @Post()
  async create(@Body() data: CreateDictionaryInput) {
    return this.dictionaryService.create(data);
  }

  /**
   * 更新字典
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: UpdateDictionaryInput) {
    return this.dictionaryService.update(Number(id), data);
  }

  /**
   * 删除字典
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.dictionaryService.delete(Number(id));
    return { success: true, message: 'Dictionary deleted' };
  }

  /**
   * 清除缓存
   */
  @Post('cache/clear')
  async clearCache() {
    await this.dictionaryService.clearCache();
    return { success: true, message: 'Cache cleared' };
  }
}
