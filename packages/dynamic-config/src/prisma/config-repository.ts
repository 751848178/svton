import type { ConfigRepository } from '../core/repository';
import type {
  ConfigItem,
  CreateConfigInput,
  UpdateConfigInput,
} from '../core/types';
import type { PrismaClientInterface } from './types';

/**
 * Prisma 配置仓储实现
 */
export class PrismaConfigRepository implements ConfigRepository {
  constructor(private prisma: PrismaClientInterface) {}

  async findAll(): Promise<ConfigItem[]> {
    return this.prisma.config.findMany({
      orderBy: [{ category: 'asc' }, { sort: 'asc' }],
    });
  }

  async findByKey(key: string): Promise<ConfigItem | null> {
    return this.prisma.config.findUnique({
      where: { key },
    });
  }

  async findByCategory(category: string): Promise<ConfigItem[]> {
    return this.prisma.config.findMany({
      where: { category },
      orderBy: { sort: 'asc' },
    });
  }

  async findPublic(): Promise<ConfigItem[]> {
    return this.prisma.config.findMany({
      where: { isPublic: true },
      orderBy: { category: 'asc' },
    });
  }

  async create(data: CreateConfigInput): Promise<ConfigItem> {
    return this.prisma.config.create({
      data: {
        key: data.key,
        value: data.value,
        type: data.type,
        category: data.category,
        label: data.label,
        description: data.description,
        isPublic: data.isPublic ?? false,
        isRequired: data.isRequired ?? false,
        defaultValue: data.defaultValue,
        options: data.options,
        sort: data.sort ?? 0,
      },
    });
  }

  async update(key: string, data: UpdateConfigInput): Promise<ConfigItem> {
    return this.prisma.config.update({
      where: { key },
      data,
    });
  }

  async delete(key: string): Promise<void> {
    await this.prisma.config.delete({
      where: { key },
    });
  }

  async batchUpdateValues(updates: Array<{ key: string; value: string }>): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      for (const { key, value } of updates) {
        const existing = await tx.config.findUnique({ where: { key } });

        if (existing) {
          await tx.config.update({
            where: { key },
            data: { value },
          });
        } else {
          // 如果不存在，创建新配置
          await tx.config.create({
            data: {
              key,
              value,
              type: 'string',
              category: key.split('.')[0] || 'default',
              label: key,
            },
          });
        }
      }
    });
  }
}
