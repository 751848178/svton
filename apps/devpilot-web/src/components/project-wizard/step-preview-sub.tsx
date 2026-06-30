/** 项目向导预览步骤子组件。 */
import { Tag } from '@svton/ui';
import type { ProjectConfig, ProjectResourceConfig } from '@/store/hooks';
export function formatResourceValue(resource: ProjectResourceConfig): string {
  if (resource.mode === 'skipped') {
    return '跳过';
  }
  if (resource.mode === 'credential') {
    return resource.credentialId ? '已选择凭证' : '未选择凭证';
  }
  if (resource.mode === 'instance') {
    return resource.instanceId ? '已选择资源实例' : '未选择资源实例';
  }
  if (resource.mode === 'pool') {
    return resource.poolId ? '将从资源池分配' : '未选择资源池';
  }
  const configuredCount = Object.values(resource.config || {}).filter(Boolean).length;
  return configuredCount > 0 ? `已填写 ${configuredCount} 项` : '未填写';
}
export function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </div>
  );
}
export function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
export function Badge({
  children,
  variant = 'default',
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
export function ProjectStructurePreview({ config }: { config: ProjectConfig }) {
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
