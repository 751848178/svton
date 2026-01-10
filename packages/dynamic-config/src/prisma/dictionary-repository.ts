import type { DictionaryRepository } from '../core/repository';
import type {
  DictionaryItem,
  CreateDictionaryInput,
  UpdateDictionaryInput,
} from '../core/types';
import type { PrismaClientInterface } from './types';

/**
 * Prisma 字典仓储实现
 */
export class PrismaDictionaryRepository implements DictionaryRepository {
  constructor(private prisma: PrismaClientInterface) {}

  async findAll(): Promise<DictionaryItem[]> {
    return this.prisma.dictionary.findMany({
      where: { isEnabled: true },
      orderBy: [{ code: 'asc' }, { sort: 'asc' }],
    });
  }

  async findByCode(code: string): Promise<DictionaryItem[]> {
    return this.prisma.dictionary.findMany({
      where: {
        code,
        isEnabled: true,
      },
      orderBy: { sort: 'asc' },
    });
  }

  async findById(id: number): Promise<DictionaryItem | null> {
    return this.prisma.dictionary.findUnique({
      where: { id },
    });
  }

  async create(data: CreateDictionaryInput): Promise<DictionaryItem> {
    return this.prisma.dictionary.create({
      data: {
        code: data.code,
        label: data.label,
        value: data.value,
        type: data.type,
        parentId: data.parentId,
        sort: data.sort ?? 0,
        description: data.description,
        extra: data.extra,
      },
    });
  }

  async update(id: number, data: UpdateDictionaryInput): Promise<DictionaryItem> {
    return this.prisma.dictionary.update({
      where: { id },
      data,
    });
  }

  async delete(id: number): Promise<void> {
    // 软删除
    await this.prisma.dictionary.update({
      where: { id },
      data: { isEnabled: false },
    });
  }
}
