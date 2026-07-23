'use client';
import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import { Button } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';
import type { ProjectConfig } from '@/store/hooks';
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
const databaseEngineNames: Record<string, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  sqlite: 'SQLite',
};
import {
  formatResourceValue,
  PreviewSection,
  PreviewItem,
  ProjectStructurePreview,
} from './step-preview-sub';
import { PackagesPreview } from './step-preview-packages';
export function StepPreview({ onPrev, onSubmit, isSubmitting }: StepProps) {
  const t = useTranslations('projectWizard');
  const { config } = useProjectConfigStore();
  const databaseEngine = config.database?.engine || 'mysql';
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
          {config.subProjects.backend && <Tag color="blue">Backend (NestJS)</Tag>}
          {config.subProjects.admin && <Tag color="blue">Admin (Next.js)</Tag>}
          {config.subProjects.mobile && <Tag color="blue">Mobile (Taro)</Tag>}
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
          {config.uiLibrary.admin && <Tag color="default">@svton/ui (Admin)</Tag>}
          {config.uiLibrary.mobile && <Tag color="default">@svton/taro-ui (Mobile)</Tag>}
          {config.hooks && <Tag color="default">@svton/hooks</Tag>}
          {!config.uiLibrary.admin && !config.uiLibrary.mobile && !config.hooks && (
            <span className="text-muted-foreground text-sm">{t('noFrontendLibsSelected')}</span>
          )}
        </div>
      </PreviewSection>
      {/* 功能 */}
      <PreviewSection title={t('businessFeatures')}>
        {config.features.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {config.features.map((featureId) => {
              const labelKey = featureNameKeys[featureId];
              return labelKey ? (
                <Tag
                  key={featureId}
                  color="orange"
                >
                  {t(labelKey)}
                </Tag>
              ) : (
                <span
                  key={featureId}
                  className="text-xs text-muted-foreground"
                >
                  {featureId}
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">{t('noFeaturesSelected')}</span>
        )}
      </PreviewSection>
      {/* 依赖包 */}
      <PackagesPreview config={config} />
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
        <Button
          variant="outline"
          onClick={onPrev}
          disabled={isSubmitting}
        >
          {t('prev')}
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          loading={isSubmitting}
        >
          {isSubmitting ? t('generating') : t('generateProject')}
        </Button>
      </div>
    </div>
  );
}
