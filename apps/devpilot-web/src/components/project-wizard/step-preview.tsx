'use client';

import { useProjectConfigStore } from '@/store/project-config';
import type { ProjectConfig } from '@/store/project-config';

interface StepProps {
  onPrev: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

// 功能名称映射
const featureNames: Record<string, string> = {
  cache: '缓存',
  'rate-limit': '限流',
  queue: '消息队列',
  'object-storage-qiniu': '对象存储 (七牛)',
  sms: '短信服务',
  oauth: 'OAuth 登录',
  payment: '支付',
  authz: '权限控制',
};

// 功能到包的映射
const featurePackages: Record<string, string[]> = {
  cache: ['@svton/nestjs-cache', '@svton/nestjs-redis'],
  'rate-limit': ['@svton/nestjs-rate-limit', '@svton/nestjs-redis'],
  queue: ['@svton/nestjs-queue', '@svton/nestjs-redis'],
  'object-storage-qiniu': ['@svton/nestjs-object-storage', '@svton/nestjs-object-storage-qiniu-kodo'],
  sms: ['@svton/nestjs-sms'],
  oauth: ['@svton/nestjs-oauth'],
  payment: ['@svton/nestjs-payment'],
  authz: ['@svton/nestjs-authz'],
};

export function StepPreview({ onPrev, onSubmit, isSubmitting }: StepProps) {
  const { config } = useProjectConfigStore();

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
        <h3 className="text-lg font-medium mb-2">配置预览</h3>
        <p className="text-sm text-muted-foreground mb-4">
          请确认以下配置信息，确认无误后点击生成项目
        </p>
      </div>

      {/* 基础信息 */}
      <PreviewSection title="基础信息">
        <PreviewItem label="项目名称" value={config.basicInfo.name} />
        <PreviewItem label="组织名称" value={config.basicInfo.orgName || '-'} />
        <PreviewItem label="项目描述" value={config.basicInfo.description || '-'} />
        <PreviewItem label="包管理器" value={config.basicInfo.packageManager} />
      </PreviewSection>

      {/* 子项目 */}
      <PreviewSection title="子项目">
        <div className="flex flex-wrap gap-2">
          {config.subProjects.backend && <Badge>Backend (NestJS)</Badge>}
          {config.subProjects.admin && <Badge>Admin (Next.js)</Badge>}
          {config.subProjects.mobile && <Badge>Mobile (Taro)</Badge>}
          {!config.subProjects.backend && !config.subProjects.admin && !config.subProjects.mobile && (
            <span className="text-muted-foreground text-sm">未选择子项目</span>
          )}
        </div>
      </PreviewSection>

      {/* UI 库和 Hooks */}
      <PreviewSection title="前端库">
        <div className="flex flex-wrap gap-2">
          {config.uiLibrary.admin && <Badge variant="secondary">@svton/ui (Admin)</Badge>}
          {config.uiLibrary.mobile && <Badge variant="secondary">@svton/taro-ui (Mobile)</Badge>}
          {config.hooks && <Badge variant="secondary">@svton/hooks</Badge>}
          {!config.uiLibrary.admin && !config.uiLibrary.mobile && !config.hooks && (
            <span className="text-muted-foreground text-sm">未选择前端库</span>
          )}
        </div>
      </PreviewSection>

      {/* 功能 */}
      <PreviewSection title="业务功能">
        {config.features.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {config.features.map((featureId) => (
              <Badge key={featureId} variant="outline">
                {featureNames[featureId] || featureId}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">未选择业务功能</span>
        )}
      </PreviewSection>

      {/* 依赖包 */}
      <PreviewSection title="将安装的依赖包">
        {allPackages.size > 0 ? (
          <div className="flex flex-wrap gap-2">
            {Array.from(allPackages).sort().map((pkg) => (
              <code key={pkg} className="px-2 py-1 bg-muted rounded text-xs">
                {pkg}
              </code>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">无额外依赖</span>
        )}
      </PreviewSection>

      {/* 资源配置 */}
      <PreviewSection title="资源配置">
        {Object.keys(config.resources).length > 0 ? (
          <div className="space-y-1">
            {Object.entries(config.resources).map(([type, value]) => (
              <PreviewItem key={type} label={type} value={value ? '已配置' : '跳过'} />
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">无资源配置（将生成 .env.example 模板）</span>
        )}
      </PreviewSection>

      {/* 生成的文件结构预览 */}
      <PreviewSection title="项目结构预览">
        <ProjectStructurePreview config={config} />
      </PreviewSection>

      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          disabled={isSubmitting}
          className="px-6 py-2 border rounded-md font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          上一步
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? '生成中...' : '生成项目'}
        </button>
      </div>
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Badge({ 
  children, 
  variant = 'default' 
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'secondary' | 'outline';
}) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border bg-background',
  };
  
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

function ProjectStructurePreview({ config }: { config: ProjectConfig }) {
  const lines: string[] = [];
  
  lines.push(`${config.basicInfo.name || 'my-project'}/`);
  lines.push('├── package.json');
  lines.push('├── pnpm-workspace.yaml');
  lines.push('├── turbo.json');
  lines.push('├── .env.example');
  lines.push('├── docker-compose.yml');
  
  if (config.subProjects.backend) {
    lines.push('├── apps/');
    lines.push('│   └── backend/');
    lines.push('│       ├── src/');
    lines.push('│       │   ├── app.module.ts');
    lines.push('│       │   └── main.ts');
    lines.push('│       ├── package.json');
    lines.push('│       └── tsconfig.json');
  }
  
  if (config.subProjects.admin) {
    lines.push('├── apps/');
    lines.push('│   └── admin/');
    lines.push('│       ├── src/');
    lines.push('│       │   └── app/');
    lines.push('│       ├── package.json');
    lines.push('│       └── next.config.js');
  }
  
  if (config.subProjects.mobile) {
    lines.push('├── apps/');
    lines.push('│   └── mobile/');
    lines.push('│       ├── src/');
    lines.push('│       │   └── pages/');
    lines.push('│       ├── package.json');
    lines.push('│       └── config/');
  }
  
  lines.push('└── README.md');

  return (
    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto font-mono">
      {lines.join('\n')}
    </pre>
  );
}
