import { Injectable } from '@nestjs/common';
import { Cacheable, CacheEvict, CachePut } from '@svton/nestjs-cache';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UserService {
  /**
   * 缓存查询结果
   * key: user:#id 会自动从参数中获取 id 值
   * ttl: 缓存过期时间（秒）
   */
  @Cacheable({ key: 'user:#id', ttl: 3600 })
  async findOne(id: number): Promise<User> {
    console.log(`Fetching user ${id} from database...`);
    // TODO: 实际项目中从数据库查询
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
    };
  }

  /**
   * 更新数据时清除缓存
   */
  @CacheEvict({ key: 'user:#id' })
  async update(id: number, data: Partial<User>): Promise<User> {
    console.log(`Updating user ${id}...`);
    // TODO: 实际项目中更新数据库
    return {
      id,
      name: data.name || `User ${id}`,
      email: data.email || `user${id}@example.com`,
    };
  }

  /**
   * 更新数据并刷新缓存
   */
  @CachePut({ key: 'user:#id' })
  async updateAndRefresh(id: number, data: Partial<User>): Promise<User> {
    console.log(`Updating and refreshing cache for user ${id}...`);
    // TODO: 实际项目中更新数据库
    return {
      id,
      name: data.name || `User ${id}`,
      email: data.email || `user${id}@example.com`,
    };
  }

  /**
   * 批量清除缓存（清除所有 user: 前缀的缓存）
   */
  @CacheEvict({ key: 'user:*', allEntries: true })
  async clearAllCache(): Promise<void> {
    console.log('Clearing all user cache...');
  }

  /**
   * 列表查询缓存
   * 支持多个参数
   */
  @Cacheable({ key: 'users:list:#page:#pageSize', ttl: 300 })
  async findAll(page: number, pageSize: number): Promise<User[]> {
    console.log(`Fetching users page ${page}...`);
    // TODO: 实际项目中从数据库查询
    return Array.from({ length: pageSize }, (_, i) => ({
      id: (page - 1) * pageSize + i + 1,
      name: `User ${(page - 1) * pageSize + i + 1}`,
      email: `user${(page - 1) * pageSize + i + 1}@example.com`,
    }));
  }
}
