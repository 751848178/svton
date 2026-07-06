'use client';
import { useTranslations } from 'next-intl';
import { useProjectConfigStore } from '@/store/hooks';
import type { ProjectConfig, ProjectResourceConfig } from '@/store/hooks';
interface StepProps {
  onPrev: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}
// 功能名称 key 映射
const featureNameKeys: Record<string, string> = {
  cache: 'featureCache',
  'rate-limit': 'featureRateLimit',
  queue: 'featureQueue',
  'object-storage-qiniu': 'featureObjectStorage',
  sms: 'featureSms',
  oauth: 'featureOauth',
  payment: 'featurePayment',
  authz: 'featureAuthz',
};
// 功能到包的映射
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
const databaseEngineNames: Record<string, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  sqlite: 'SQLite',
};
import {
  formatResourceValue,
  PreviewSection,
  PreviewItem,
  Badge,
  ProjectStructurePreview,
} from './step-preview-sub';
export function StepPreview({ onPrev, onSubmit, isSubmitting }: StepProps) {
  const t = useTranslations('projectWizard');
  const { config } = useProjectConfigStore();
  const databaseEngine = config.database?.engine || 'mysql';
  // 计算所有需要的包
  const allPackages = new Set<string>();

  // 基础包
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
  // 功能相关包
  config.features.forEach((featureId) => {
    const packages = featurePackages[featureId] || [];
    packages.forEach((pkg) => allPackages.add(pkg));
  });
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">{t('configPreview')}</h3>
        <p className="text-sm text-muted-foreground mb-4">{t('configPreviewHint')}</p>
      </div>
      {/* 基础信息 */}
      <PreviewSection title={t('basicInfo')}>
        <PreviewItem
          label={t('projectName')}
          value={config.basicInfo.name}
        />
        <PreviewItem
          label={t('orgName')}
          value={config.basicInfo.orgName || '-'}
        />
        <PreviewItem
          label={t('projectDescription')}
          value={config.basicInfo.description || '-'}
        />
        <PreviewItem
          label={t('packageManager')}
          value={config.basicInfo.packageManager}
        />
      </PreviewSection>
      {/* 子项目 */}
      <PreviewSection title={t('subProjects')}>
        <div className="flex flex-wrap gap-2">
          {config.subProjects.backend && <Badge>Backend (NestJS)</Badge>}
          {config.subProjects.admin && <Badge>Admin (Next.js)</Badge>}
          {config.subProjects.mobile && <Badge>Mobile (Taro)</Badge>}
          {!config.subProjects.backend &&
            !config.subProjects.admin &&
            !config.subProjects.mobile && (
              <span className="text-muted-foreground text-sm">{t('noSubProjectsSelected')}</span>
            )}
        </div>
      </PreviewSection>
      {config.subProjects.backend && (
        <PreviewSection title={t('database')}>
          <PreviewItem
            label={t('engine')}
            value={databaseEngineNames[databaseEngine] || databaseEngine}
          />
        </PreviewSection>
      )}
      {/* UI 库和 Hooks */}
      <PreviewSection title={t('frontendLibs')}>
        <div className="flex flex-wrap gap-2">
          {config.uiLibrary.admin && <Badge variant="secondary">@svton/ui (Admin)</Badge>}
          {config.uiLibrary.mobile && <Badge variant="secondary">@svton/taro-ui (Mobile)</Badge>}
          {config.hooks && <Badge variant="secondary">@svton/hooks</Badge>}
          {!config.uiLibrary.admin && !config.uiLibrary.mobile && !config.hooks && (
            <span className="text-muted-foreground text-sm">{t('noFrontendLibsSelected')}</span>
          )}
        </div>
      </PreviewSection>
      {/* 功能 */}
      <PreviewSection title={t('businessFeatures')}>
        {config.features.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {config.features.map((featureId) => (
              <Badge
                key={featureId}
                variant="outline"
              >
                {(featureNameKeys[featureId] && t(featureNameKeys[featureId])) || featureId}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">{t('noFeaturesSelected')}</span>
        )}
      </PreviewSection>
      {/* 依赖包 */}
      <PreviewSection title={t('packagesToInstall')}>
        {allPackages.size > 0 ? (
          <div className="flex flex-wrap gap-2">
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
        ) : (
          <span className="text-muted-foreground text-sm">{t('noExtraDeps')}</span>
        )}
      </PreviewSection>
      {/* 资源配置 */}
      <PreviewSection title={t('resourceConfig')}>
        {Object.keys(config.resources).length > 0 ? (
          <div className="space-y-1">
            {Object.entries(config.resources).map(([type, value]) => (
              <PreviewItem
                key={type}
                label={type}
                value={formatResourceValue(value, t)}
              />
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">{t('noResourceConfig')}</span>
        )}
      </PreviewSection>
      {/* 生成的文件结构预览 */}
      <PreviewSection title={t('projectStructure')}>
        <ProjectStructurePreview config={config} />
      </PreviewSection>
      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          disabled={isSubmitting}
          className="px-6 py-2 border rounded-md font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          {t('prev')}
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? t('generating') : t('generateProject')}
        </button>
      </div>
    </div>
  );
}
