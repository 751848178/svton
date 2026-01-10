import type { LoggerPlugin, LogEvent } from '../types';

/**
 * 敏感信息过滤插件配置
 */
export interface SensitiveFilterPluginOptions {
  /** 敏感字段名列表 */
  sensitiveFields?: string[];
  /** 替换值 */
  replacement?: string;
  /** 自定义过滤函数 */
  customFilter?: (key: string, value: unknown) => unknown;
}

/**
 * 默认敏感字段
 */
const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'ssn',
  'socialSecurity',
  'social_security',
  'phone',
  'mobile',
  'email',
  'idCard',
  'id_card',
  'bankAccount',
  'bank_account',
];

/**
 * 过滤对象中的敏感信息
 */
function filterSensitiveData(
  data: unknown,
  sensitiveFields: string[],
  replacement: string,
  customFilter?: (key: string, value: unknown) => unknown
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => filterSensitiveData(item, sensitiveFields, replacement, customFilter));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // 检查是否是敏感字段
      const isSensitive = sensitiveFields.some(
        (field) => lowerKey === field.toLowerCase() || lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        result[key] = replacement;
      } else if (customFilter) {
        result[key] = customFilter(key, value);
      } else if (typeof value === 'object') {
        result[key] = filterSensitiveData(value, sensitiveFields, replacement, customFilter);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  return data;
}

/**
 * 创建敏感信息过滤插件
 */
export function createSensitiveFilterPlugin(options: SensitiveFilterPluginOptions = {}): LoggerPlugin {
  const {
    sensitiveFields = DEFAULT_SENSITIVE_FIELDS,
    replacement = '[FILTERED]',
    customFilter,
  } = options;

  return {
    name: 'sensitive-filter',

    hooks: {
      beforeLog(event: LogEvent) {
        return {
          ...event,
          data: filterSensitiveData(event.data, sensitiveFields, replacement, customFilter) as Record<string, unknown>,
          user: event.user
            ? (filterSensitiveData(event.user, sensitiveFields, replacement, customFilter) as typeof event.user)
            : undefined,
        };
      },

      beforeReport(events: LogEvent[]) {
        return events.map((event) => ({
          ...event,
          data: filterSensitiveData(event.data, sensitiveFields, replacement, customFilter) as Record<string, unknown>,
          user: event.user
            ? (filterSensitiveData(event.user, sensitiveFields, replacement, customFilter) as typeof event.user)
            : undefined,
        }));
      },
    },
  };
}
