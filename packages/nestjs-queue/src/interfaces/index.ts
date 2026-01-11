import type { ModuleMetadata, Type } from '@nestjs/common';
import type { ConnectionOptions, JobsOptions } from 'bullmq';

export interface QueueModuleOptions {
  /** Redis 连接配置 */
  connection: ConnectionOptions;
  /** 默认 Job 配置 */
  defaultJobOptions?: JobsOptions;
  /** 队列前缀 */
  prefix?: string;
}

export interface QueueOptionsFactory {
  createQueueOptions(): Promise<QueueModuleOptions> | QueueModuleOptions;
}

export interface QueueModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<QueueOptionsFactory>;
  useClass?: Type<QueueOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<QueueModuleOptions> | QueueModuleOptions;
  inject?: unknown[];
}

export interface ProcessorOptions {
  /** 队列名称 */
  name: string;
  /** 并发数 */
  concurrency?: number;
}

export interface ProcessOptions {
  /** Job 名称，默认为方法名 */
  name?: string;
  /** 并发数 */
  concurrency?: number;
}
