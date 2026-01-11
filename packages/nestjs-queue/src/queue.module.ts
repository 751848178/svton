import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import { Queue } from 'bullmq';
import type {
  QueueModuleOptions,
  QueueModuleAsyncOptions,
  QueueOptionsFactory,
} from './interfaces';
import { QUEUE_OPTIONS } from './constants';
import { QueueService } from './queue.service';
import { getQueueToken } from './utils';

@Module({})
export class QueueModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: QueueModuleOptions): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: QueueModule,
      global: true,
      providers,
      exports: [QUEUE_OPTIONS, QueueService],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: QueueModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: QueueModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [QUEUE_OPTIONS, QueueService],
    };
  }

  /**
   * 注册特定队列
   */
  static registerQueue(...names: string[]): DynamicModule {
    const providers: Provider[] = names.map((name) => ({
      provide: getQueueToken(name),
      useFactory: (queueService: QueueService) => queueService.getQueue(name),
      inject: [QueueService],
    }));

    return {
      module: QueueModule,
      providers,
      exports: providers.map((p) => (p as { provide: string }).provide),
    };
  }

  private static createProviders(options: QueueModuleOptions): Provider[] {
    return [
      {
        provide: QUEUE_OPTIONS,
        useValue: options,
      },
      QueueService,
    ];
  }

  private static createAsyncProviders(options: QueueModuleAsyncOptions): Provider[] {
    const providers: Provider[] = [QueueService];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: QUEUE_OPTIONS,
          useFactory: async (optionsFactory: QueueOptionsFactory) =>
            optionsFactory.createQueueOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: QUEUE_OPTIONS,
        useFactory: async (optionsFactory: QueueOptionsFactory) =>
          optionsFactory.createQueueOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: QUEUE_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    return providers;
  }
}
