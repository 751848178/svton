import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { chmod, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '../../generated/client/index.js';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly dataRoot = path.resolve(process.env.SHIPKIT_DATA_DIR ?? path.join(process.cwd(), '.data'));

  constructor() {
    const root = path.resolve(process.env.SHIPKIT_DATA_DIR ?? path.join(process.cwd(), '.data'));
    super({ datasources: { db: { url: process.env.DATABASE_URL ?? `file:${path.join(root, 'platform.db')}` } } });
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.dataRoot, { recursive: true, mode: 0o700 });
    await chmod(this.dataRoot, 0o700);
    await this.$connect();
    await this.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await this.$queryRawUnsafe('PRAGMA busy_timeout=5000');
    await this.workspace.upsert({ where: { id: 'local' }, create: { id: 'local', name: '本机工作空间' }, update: {} });
    await this.actor.upsert({ where: { id: 'local-controller' }, create: { id: 'local-controller', kind: 'local', name: '本机控制端' }, update: {} });
    await chmod(path.join(this.dataRoot, 'platform.db'), 0o600).catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
