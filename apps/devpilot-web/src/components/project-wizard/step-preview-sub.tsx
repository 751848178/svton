/** 项目向导预览步骤子组件。 */
import { useTranslations } from 'next-intl';
import type { ProjectConfig, ProjectResourceConfig } from '@/store/hooks';

type WizardTranslator = ReturnType<typeof useTranslations<'projectWizard'>>;

export function formatResourceValue(
  resource: ProjectResourceConfig,
  t: WizardTranslator,
): string {
  if (resource.mode === 'skipped') {
    return t('modeSkipped');
  }
  if (resource.mode === 'credential') {
    if (!resource.credentialId) return t('credentialNotSelected');
    return resource.resourceName || t('credentialSelected');
  }
  if (resource.mode === 'instance') {
    if (!resource.instanceId) return t('instanceNotSelected');
    return resource.resourceName || t('instanceSelected');
  }
  if (resource.mode === 'pool') {
    if (!resource.poolId) return t('poolNotSelected');
    return resource.resourceName || t('poolWillAllocate');
  }
  const filledValues = Object.values(resource.config || {}).filter(Boolean);
  return filledValues.length > 0 ? filledValues.join(' / ') : t('notFilled');
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
export function ProjectStructurePreview({ config }: { config: ProjectConfig }) {
  const lines: string[] = [];

  lines.push(`${config.basicInfo.name || 'my-project'}/`);
  lines.push('├── package.json');
  lines.push('├── pnpm-workspace.yaml');
  lines.push('├── turbo.json');
  lines.push('├── .env.example');
  lines.push('├── docker-compose.yml');

  // 子项目统一挂到单个 apps/ 父目录下，避免每个子项目都重复输出 apps/。
  // 多个子项目时：最后一个用 └──（末子），其余用 ├──，避免全部显示成末子。
  const selected: Array<{ entry: string[] }> = [];
  if (config.subProjects.backend) {
    selected.push({
      entry: [
        '{branch}backend/',
        '│       ├── src/',
        '│       │   ├── app.module.ts',
        '│       │   └── main.ts',
        '│       ├── package.json',
        '│       └── tsconfig.json',
      ],
    });
  }
  if (config.subProjects.admin) {
    selected.push({
      entry: [
        '{branch}admin/',
        '│       ├── src/',
        '│       │   └── app/',
        '│       ├── package.json',
        '│       └── next.config.js',
      ],
    });
  }
  if (config.subProjects.mobile) {
    selected.push({
      entry: [
        '{branch}mobile/',
        '│       ├── src/',
        '│       │   └── pages/',
        '│       ├── package.json',
        '│       └── config/',
      ],
    });
  }
  if (selected.length > 0) {
    lines.push('├── apps/');
    selected.forEach((item, index) => {
      const isLast = index === selected.length - 1;
      // 末子用 └──，其余用 ├──；内部缩进行保持 │ 不变。
      const connector = isLast ? '│   └── ' : '│   ├── ';
      item.entry.forEach((line, lineIndex) => {
        lines.push(lineIndex === 0 ? line.replace('{branch}', connector) : line);
      });
    });
  }

  lines.push('└── README.md');
  return (
    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto font-mono">
      {lines.join('\n')}
    </pre>
  );
}
