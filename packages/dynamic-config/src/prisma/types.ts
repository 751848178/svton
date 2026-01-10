/**
 * Prisma Client 接口
 * 抽象 Prisma Client，避免直接依赖具体版本
 */

export interface PrismaConfigDelegate {
  findMany(args?: {
    where?: { category?: string; isPublic?: boolean };
    orderBy?: any;
  }): Promise<any[]>;

  findUnique(args: { where: { key: string } }): Promise<any | null>;

  create(args: { data: any }): Promise<any>;

  update(args: { where: { key: string }; data: any }): Promise<any>;

  delete(args: { where: { key: string } }): Promise<any>;
}

export interface PrismaDictionaryDelegate {
  findMany(args?: {
    where?: { code?: string; isEnabled?: boolean };
    orderBy?: any;
  }): Promise<any[]>;

  findUnique(args: { where: { id: number } }): Promise<any | null>;

  create(args: { data: any }): Promise<any>;

  update(args: { where: { id: number }; data: any }): Promise<any>;
}

export interface PrismaClientInterface {
  config: PrismaConfigDelegate;
  dictionary: PrismaDictionaryDelegate;
  $transaction<T>(fn: (prisma: any) => Promise<T>): Promise<T>;
}
