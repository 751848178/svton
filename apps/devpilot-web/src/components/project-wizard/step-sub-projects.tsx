'use client';

import { usePersistFn } from '@svton/hooks';
import { Card, Tag } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

const SUB_PROJECT_OPTIONS = [
  {
    id: 'backend' as const,
    title: '后端服务',
    description: 'NestJS API 服务，包含 Prisma ORM、JWT 认证、Swagger 文档',
    icon: '🚀',
  },
  {
    id: 'admin' as const,
    title: '管理后台',
    description: 'Next.js 管理后台，包含 TailwindCSS、shadcn/ui 组件',
    icon: '🖥️',
  },
  {
    id: 'mobile' as const,
    title: '移动端小程序',
    description: 'Taro 跨端应用，支持微信小程序、H5 等多端',
    icon: '📱',
  },
];

export function StepSubProjects({ onNext, onPrev }: StepProps) {
  const { config, setSubProjects, setUiLibrary, setHooks } = useProjectConfigStore();
  const hasAnySelected = Object.values(config.subProjects).some(Boolean);
  const hasAdminOrMobile = config.subProjects.admin || config.subProjects.mobile;

  const handleToggle = usePersistFn((id: 'backend' | 'admin' | 'mobile') =>
    setSubProjects({ [id]: !config.subProjects[id] }),
  );
  const handleNext = usePersistFn(() => onNext());
  const handlePrev = usePersistFn(() => onPrev());

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-medium">选择子项目</h3>
        <p className="mb-4 text-sm text-muted-foreground">选择你需要的子项目类型，至少选择一个</p>
        <div className="grid gap-4">
          {SUB_PROJECT_OPTIONS.map((option) => (
            <div
              key={option.id}
              onClick={() => handleToggle(option.id)}
              className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${config.subProjects[option.id] ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
            >
              <div className="text-2xl">{option.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{option.title}</h4>
                  {config.subProjects[option.id] ? <Tag color="blue">已选择</Tag> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
              </div>
              <input
                type="checkbox"
                checked={config.subProjects[option.id]}
                onChange={() => {}}
                className="mt-1 h-5 w-5"
              />
            </div>
          ))}
        </div>
      </div>
      {hasAdminOrMobile ? (
        <div className="border-t pt-6">
          <h3 className="mb-4 text-lg font-medium">前端工具库</h3>
          {config.subProjects.admin ? (
            <label className="mb-3 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={config.uiLibrary.admin}
                onChange={(e) => setUiLibrary({ admin: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm">
                使用 <code className="rounded bg-muted px-1">@svton/ui</code> 组件库（管理后台）
              </span>
            </label>
          ) : null}
          {config.subProjects.mobile ? (
            <label className="mb-3 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={config.uiLibrary.mobile}
                onChange={(e) => setUiLibrary({ mobile: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm">
                使用 <code className="rounded bg-muted px-1">@svton/taro-ui</code> 组件库（小程序）
              </span>
            </label>
          ) : null}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={config.hooks}
              onChange={(e) => setHooks(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">
              使用 <code className="rounded bg-muted px-1">@svton/hooks</code> React Hooks 工具库
            </span>
          </label>
        </div>
      ) : null}
      {!hasAnySelected ? (
        <ErrorBanner
          message="请至少选择一个子项目"
          variant="inline"
        />
      ) : null}
      <div className="flex justify-between pt-4">
        <button
          onClick={handlePrev}
          className="rounded-md border px-6 py-2 font-medium transition-colors hover:bg-accent"
        >
          上一步
        </button>
        <button
          onClick={handleNext}
          disabled={!hasAnySelected}
          className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一步
        </button>
      </div>
    </div>
  );
}
