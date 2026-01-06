import { DynamicModule, Module, Provider, InjectionToken } from '@nestjs/common';
import {
  ObjectStorageModuleOptions,
  ObjectStorageModuleAsyncOptions,
  ObjectStorageOptionsFactory,
} from './interfaces';
import {
  OBJECT_STORAGE_CLIENT,
  OBJECT_STORAGE_OPTIONS,
  OBJECT_STORAGE_ADAPTER,
} from './constants';
import { ObjectStorageAdapter, ObjectStorageClient } from './interfaces';

@Module({})
export class ObjectStorageModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: ObjectStorageModuleOptions): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: ObjectStorageModule,
      global: true,
      providers,
      exports: [OBJECT_STORAGE_CLIENT, OBJECT_STORAGE_OPTIONS],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: ObjectStorageModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: ObjectStorageModule,
      global: true,
      imports: options.imports || [],
      providers,
      exports: [OBJECT_STORAGE_CLIENT, OBJECT_STORAGE_OPTIONS],
    };
  }

  private static createProviders(options: ObjectStorageModuleOptions): Provider[] {
    return [
      {
        provide: OBJECT_STORAGE_OPTIONS,
        useValue: options,
      },
      {
        provide: OBJECT_STORAGE_ADAPTER,
        useFactory: async () => {
          const adapter = typeof options.adapter === 'function'
            ? await options.adapter()
            : options.adapter;
          return adapter;
        },
      },
      {
        provide: OBJECT_STORAGE_CLIENT,
        useFactory: async (adapter: ObjectStorageAdapter): Promise<ObjectStorageClient> => {
          return adapter.createClient();
        },
        inject: [OBJECT_STORAGE_ADAPTER],
      },
    ];
  }

  private static createAsyncProviders(options: ObjectStorageModuleAsyncOptions): Provider[] {
    const providers: Provider[] = [
      {
        provide: OBJECT_STORAGE_ADAPTER,
        useFactory: async (moduleOptions: ObjectStorageModuleOptions) => {
          const adapter = typeof moduleOptions.adapter === 'function'
            ? await moduleOptions.adapter()
            : moduleOptions.adapter;
          return adapter;
        },
        inject: [OBJECT_STORAGE_OPTIONS],
      },
      {
        provide: OBJECT_STORAGE_CLIENT,
        useFactory: async (adapter: ObjectStorageAdapter): Promise<ObjectStorageClient> => {
          return adapter.createClient();
        },
        inject: [OBJECT_STORAGE_ADAPTER],
      },
    ];

    if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: OBJECT_STORAGE_OPTIONS,
          useFactory: async (optionsFactory: ObjectStorageOptionsFactory) =>
            optionsFactory.createObjectStorageOptions(),
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: OBJECT_STORAGE_OPTIONS,
        useFactory: async (optionsFactory: ObjectStorageOptionsFactory) =>
          optionsFactory.createObjectStorageOptions(),
        inject: [options.useExisting],
      });
    } else if (options.useFactory) {
      providers.push({
        provide: OBJECT_STORAGE_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject || []) as InjectionToken[],
      });
    }

    return providers;
  }
}
