import { publicData } from './public-data.js';

export function executionError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (/ConfigError|YAMLException/.test(name) || /invalid config|ship\.config|builder\.dynamic|registry\.(?:url|namespace)|runtime\.targets/i.test(message)) {
    return '项目配置无效或已变更，请检查本机私密配置引用';
  }
  return publicData(message);
}
