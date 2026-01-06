import { Inject } from '@nestjs/common';
import { SMS_CLIENT, SMS_OPTIONS } from './constants';

/**
 * 注入短信客户端
 */
export const InjectSms = () => Inject(SMS_CLIENT);

/**
 * 注入短信配置
 */
export const InjectSmsOptions = () => Inject(SMS_OPTIONS);
