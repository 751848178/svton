// Module
export { QueueModule } from './queue.module';

// Service
export { QueueService } from './queue.service';

// Decorators
export { Processor, Process, InjectQueue } from './decorators';

// Interfaces
export type {
  QueueModuleOptions,
  QueueModuleAsyncOptions,
  QueueOptionsFactory,
  ProcessorOptions,
  ProcessOptions,
} from './interfaces';

// Utils
export { getQueueToken, getWorkerToken } from './utils';

// Constants
export { QUEUE_OPTIONS, QUEUE_PROCESSOR_METADATA, QUEUE_PROCESS_METADATA } from './constants';

// Re-export BullMQ types
export type { Job, Queue, Worker, JobsOptions } from 'bullmq';
