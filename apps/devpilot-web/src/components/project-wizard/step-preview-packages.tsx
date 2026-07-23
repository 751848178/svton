/**
 * 项目向导预览 — 依赖包清单
 *
 * 单一职责：根据项目配置计算将安装的依赖包，并渲染为预览分区。
 * 从 step-preview 抽出以保持主组件在 200 行以内、单一职责。
 */

'use client';
import { useTranslations } from 'next-intl';
import type { ProjectConfig } from '@/store/hooks';
import { PreviewSection } from './step-preview-sub';

/** 功能到包的映射 */
const featurePackages: Record<string, string[]> = {
  cache: ['@svton/nestjs-cache', '@svton/nestjs-redis'],
  'rate-limit': ['@svton/nestjs-rate-limit', '@svton/nestjs-redis'],
  queue: ['@svton/nestjs-queue', '@svton/nestjs-redis'],
  'object-storage-qiniu': [
    '@svton/nestjs-object-storage',
    '@svton/nestjs-object-storage-qiniu-kodo',
  ],
  sms: ['@svton/nestjs-sms'],
  oauth: ['@svton/nestjs-oauth'],
  payment: ['@svton/nestjs-payment'],
  authz: ['@svton/nestjs-authz'],
};

/** 计算项目所需安装的全部包（去重）。 */
export function collectPackages(config: ProjectConfig): Set<string> {
  const allPackages = new Set<string>();

  if (config.subProjects.backend) {
    allPackages.add('@svton/nestjs-logger');
    allPackages.add('@svton/nestjs-config-schema');
    allPackages.add('@svton/nestjs-http');
  }

  if (config.subProjects.admin) {
    allPackages.add('@svton/ui');
    if (config.uiLibrary.admin) allPackages.add('@svton/ui');
  }

  if (config.subProjects.mobile) {
    if (config.uiLibrary.mobile) allPackages.add('@svton/taro-ui');
  }

  if (config.hooks) {
    allPackages.add('@svton/hooks');
  }

  config.features.forEach((featureId) => {
    const packages = featurePackages[featureId] || [];
    packages.forEach((pkg) => allPackages.add(pkg));
  });

  return allPackages;
}

/** 渲染将安装的依赖包预览分区。 */
export function PackagesPreview({ config }: { config: ProjectConfig }) {
  const t = useTranslations('projectWizard');
  const allPackages = collectPackages(config);
  return (
    <PreviewSection
      title={`${t('packagesToInstall')}（${allPackages.size}）`}
    >
      {allPackages.size > 0 ? (
        <div className="max-h-40 overflow-y-auto">
          <div className="flex flex-wrap gap-1.5">
            {Array.from(allPackages)
              .sort()
              .map((pkg) => (
                <code
                  key={pkg}
                  className="px-2 py-1 bg-muted rounded text-xs"
                >
                  {pkg}
                </code>
              ))}
          </div>
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">{t('noExtraDeps')}</span>
      )}
    </PreviewSection>
  );
}
