import { SVTON_SCHEMA_VERSION, SvtonProjectConfig } from './types';

/**
 * 在用户 `svton.config.ts` 中声明的类型安全入口。
 *
 * 当前仅校验 schema 版本后原样返回；价值在于编辑器自动补全与未来的迁移钩子。
 *
 * @example
 * ```ts
 * import { defineSvtonProject } from '@svton/cli';
 *
 * export default defineSvtonProject({
 *   schema: 1,
 *   apps: { api: { dir: 'apps/backend', type: 'nest', port: 4000 } },
 *   database: { orm: 'prisma', dir: 'apps/backend' },
 * });
 * ```
 */
export function defineSvtonProject(config: SvtonProjectConfig): SvtonProjectConfig {
  if (config.schema !== SVTON_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported svton schema: got ${config.schema}, expected ${SVTON_SCHEMA_VERSION}. ` +
        `Upgrade @svton/cli or update svton.config.ts.`,
    );
  }
  return config;
}
