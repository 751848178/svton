import { ModuleMetadata, Type } from '@nestjs/common';
import { SmsAdapter, SmsAdapterFactory } from './sms.interface';

/**
 * SMS 模块配置选项
 */
export interface SmsModuleOptions {
  /** 默认签名 */
  defaultSignName?: string;
  /** 适配器实例或工厂 */
  adapter: SmsAdapter | SmsAdapterFactory;
}

/**
 * 异步配置选项工厂接口
 */
export interface SmsOptionsFactory {
  createSmsOptions(): Promise<SmsModuleOptions> | SmsModuleOptions;
}

/**
 * 异步模块配置选项
 */
export interface SmsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<SmsOptionsFactory>;
  useClass?: Type<SmsOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<SmsModuleOptions> | SmsModuleOptions;
  inject?: unknown[];
}
