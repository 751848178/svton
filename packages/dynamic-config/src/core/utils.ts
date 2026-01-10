import type { ConfigValueType } from './types';

/**
 * 解析配置值
 */
export function parseConfigValue(value: string, type: ConfigValueType): any {
  try {
    switch (type) {
      case 'number':
        return Number(value);

      case 'boolean':
        return value === 'true' || value === '1';

      case 'json':
      case 'array':
        return JSON.parse(value);

      case 'password':
        // 密码类型不解密，由使用方处理
        return value;

      case 'enum':
      case 'string':
      default:
        return value;
    }
  } catch {
    return value;
  }
}

/**
 * 序列化配置值
 */
export function stringifyConfigValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * 推断值类型
 */
export function inferValueType(value: any): ConfigValueType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object' && value !== null) return 'json';
  return 'string';
}

/**
 * 从 key 中提取 category
 * 例如: 'storage.cos.secretId' => 'storage'
 */
export function extractCategory(key: string): string {
  const parts = key.split('.');
  return parts[0] || 'default';
}

/**
 * 构建嵌套配置对象
 * 将扁平的 key-value 转换为嵌套结构
 */
export function buildNestedConfig(
  configs: Array<{ key: string; value: any }>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const { key, value } of configs) {
    const parts = key.split('.');

    if (parts.length === 1) {
      result[key] = value;
    } else {
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
    }
  }

  return result;
}

/**
 * 扁平化嵌套配置对象
 */
export function flattenConfig(
  obj: Record<string, any>,
  prefix = '',
): Array<{ key: string; value: any }> {
  const result: Array<{ key: string; value: any }> = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result.push(...flattenConfig(value, fullKey));
    } else {
      result.push({ key: fullKey, value });
    }
  }

  return result;
}

/**
 * 构建字典树
 */
export function buildDictionaryTree<T extends { id: number; parentId?: number | null }>(
  items: T[],
): (T & { children: T[] })[] {
  type TreeNode = T & { children: TreeNode[] };

  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  // 创建所有节点
  items.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  // 构建树
  items.forEach((item) => {
    const node = map.get(item.id);
    if (node) {
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }
  });

  return roots;
}
