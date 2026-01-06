import { Inject } from '@nestjs/common';
import { OBJECT_STORAGE_CLIENT, OBJECT_STORAGE_OPTIONS } from './constants';

/**
 * 注入对象存储客户端
 */
export const InjectObjectStorage = () => Inject(OBJECT_STORAGE_CLIENT);

/**
 * 注入对象存储配置
 */
export const InjectObjectStorageOptions = () => Inject(OBJECT_STORAGE_OPTIONS);
