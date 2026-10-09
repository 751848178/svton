import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { mkdir, open, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '../../generated/client/index.js';
import { DatabaseService } from '../database/database.service.js';
import { publicData } from '../transport/public-data.js';

const STAGES = new Set(['provision', 'build', 'push', 'cleanup', 'deploy', 'verify']);

@Injectable()
export class TaskLogService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async append(taskId: string, stageKey: string, serviceKey: string | undefined, message: string): Promise<number> {
    this.validate(stageKey, serviceKey);
    const text = publicData(message);
    const bytes = await this.write(taskId, stageKey, '', `${serviceKey ? `[${serviceKey}] ` : ''}${text}\n`);
    if (serviceKey) await this.write(taskId, stageKey, serviceKey, `${text}\n`);
    return bytes;
  }
  async read(taskId: string, stageKey: string, serviceKey: string | undefined, offset: number): Promise<unknown> {
    this.validate(stageKey, serviceKey);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new BadRequestException('offset 必须为非负字节位置');
    const archive = await this.db.logArchive.findUnique({ where: { taskId_stageKey_serviceKey: { taskId, stageKey, serviceKey: serviceKey ?? '' } } });
    if (!archive) return { text: '', nextOffset: 0, totalBytes: 0, complete: await this.complete(taskId) };
    const file = path.join(this.db.dataRoot, archive.relativePath);
    const size = (await stat(file).catch(() => null))?.size ?? 0;
    const start = Math.min(offset, size);
    const length = Math.min(size - start, 128 * 1024);
    if (!length) return { text: '', nextOffset: start, totalBytes: size, complete: archive.complete };
    const handle = await open(file, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const read = await handle.read(buffer, 0, length, start);
      const bytes = utf8Boundary(buffer.subarray(0, read.bytesRead));
      return { text: buffer.subarray(0, bytes).toString('utf8'), nextOffset: start + bytes, totalBytes: size, complete: archive.complete };
    } finally { await handle.close(); }
  }
  async finish(taskId: string, transaction?: Prisma.TransactionClient): Promise<void> { await (transaction ?? this.db).logArchive.updateMany({ where: { taskId }, data: { complete: true } }); }
  private async write(taskId: string, stageKey: string, serviceKey: string, text: string): Promise<number> {
    const relativePath = path.join('logs', taskId, `${stageKey}--${serviceKey || 'all'}.log`);
    const archive = await this.db.logArchive.upsert({
      where: { taskId_stageKey_serviceKey: { taskId, stageKey, serviceKey } },
      create: { taskId, stageKey, serviceKey, relativePath }, update: { complete: false },
    });
    const file = path.join(this.db.dataRoot, relativePath);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const handle = await open(file, 'a', 0o600);
    try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
    const bytes = (await stat(file)).size;
    await this.db.logArchive.update({ where: { id: archive.id }, data: { bytes } });
    return bytes;
  }
  private validate(stageKey: string, serviceKey?: string): void {
    if (!STAGES.has(stageKey) || (serviceKey && !/^[a-z][a-z0-9-]{0,62}$/.test(serviceKey))) throw new BadRequestException('日志阶段或服务无效');
  }
  private async complete(taskId: string): Promise<boolean> {
    const task = await this.db.task.findUniqueOrThrow({ where: { id: taskId } });
    return task.activeScope === null && task.cleanupState !== 'releasing';
  }
}

function utf8Boundary(buffer: Buffer): number {
  if (!buffer.length) return 0;
  let lead = buffer.length - 1;
  while (lead > 0 && (buffer[lead]! & 0xc0) === 0x80) lead--;
  const byte = buffer[lead]!;
  const width = byte < 0x80 ? 1 : byte < 0xe0 ? 2 : byte < 0xf0 ? 3 : 4;
  return lead + width > buffer.length ? lead : buffer.length;
}
