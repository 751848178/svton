import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue, Worker, Job, JobsOptions } from 'bullmq';
import { QUEUE_OPTIONS } from './constants';
import type { QueueModuleOptions } from './interfaces';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  constructor(
    @Inject(QUEUE_OPTIONS) private readonly options: QueueModuleOptions,
  ) {}

  async onModuleDestroy() {
    // 关闭所有 workers
    for (const [name, worker] of this.workers) {
      this.logger.log(`Closing worker: ${name}`);
      await worker.close();
    }
    // 关闭所有 queues
    for (const [name, queue] of this.queues) {
      this.logger.log(`Closing queue: ${name}`);
      await queue.close();
    }
  }

  /**
   * 获取或创建队列
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.options.connection,
        prefix: this.options.prefix,
        defaultJobOptions: this.options.defaultJobOptions,
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }

  /**
   * 添加 Job 到队列
   */
  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, opts);
  }

  /**
   * 批量添加 Jobs
   */
  async addBulk<T>(
    queueName: string,
    jobs: Array<{ name: string; data: T; opts?: JobsOptions }>,
  ): Promise<Job<T>[]> {
    const queue = this.getQueue(queueName);
    return queue.addBulk(jobs);
  }

  /**
   * 注册 Worker
   */
  registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<unknown>,
    concurrency = 1,
  ): Worker {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!;
    }

    const worker = new Worker(queueName, processor, {
      connection: this.options.connection,
      prefix: this.options.prefix,
      concurrency,
    });

    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed in queue ${queueName}: ${err.message}`);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(queueName: string) {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * 清空队列
   */
  async drain(queueName: string, delayed = false): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain(delayed);
  }

  /**
   * 暂停队列
   */
  async pause(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  /**
   * 恢复队列
   */
  async resume(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }
}
