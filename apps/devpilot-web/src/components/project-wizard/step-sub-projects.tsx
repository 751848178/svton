'use client';

import { useProjectConfigStore } from '@/store/project-config';
import { cn } from '@/lib/utils';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

const subProjectOptions = [
  {
    id: 'backend',
    title: '后端服务',
    description: 'NestJS API 服务，包含 Prisma ORM、JWT 认证、Swagger 文档',
    icon: '🚀',
  },
  {
    id: 'admin',
    title: '管理后台',
    description: 'Next.js 管理后台，包含 TailwindCSS、shadcn/ui 组件',
    icon: '🖥️',
  },
  {
    id: 'mobile',
    title: '移动端小程序',
    description: 'Taro 跨端应用，支持微信小程序、H5 等多端',
    icon: '📱',
  },
] as const;

export function StepSubProjects({ onNext, onPrev }: StepProps) {
  const { config, setSubProjects, setUiLibrary, setHooks } = useProjectConfigStore();

  const handleToggle = (id: 'backend' | 'admin' | 'mobile') => {
    setSubProjects({ [id]: !config.subProjects[id] });
  };

  const hasAnySelected = Object.values(config.subProjects).some(Boolean);
  const hasAdminOrMobile = config.subProjects.admin || config.subProjects.mobile;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">选择子项目</h3>
        <p className="text-sm text-muted-foreground mb-4">
          选择你需要的子项目类型，至少选择一个
        </p>

        <div className="grid gap-4">
          {subProjectOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => handleToggle(option.id)}
              className={cn(
                'flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors',
                config.subProjects[option.id]
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="text-2xl">{option.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{option.title}</h4>
                  {config.subProjects[option.id] && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                      已选择
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {option.description}
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.subProjects[option.id]}
                onChange={() => {}}
                className="w-5 h-5 mt-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* UI 库和 Hooks 选择 */}
      {hasAdminOrMobile && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-4">前端工具库</h3>
          
          {config.subProjects.admin && (
            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.uiLibrary.admin}
                onChange={(e) => setUiLibrary({ admin: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">
                使用 <code className="bg-muted px-1 rounded">@svton/ui</code> 组件库（管理后台）
              </span>
            </label>
          )}

          {config.subProjects.mobile && (
            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.uiLibrary.mobile}
                onChange={(e) => setUiLibrary({ mobile: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">
                使用 <code className="bg-muted px-1 rounded">@svton/taro-ui</code> 组件库（小程序）
              </span>
            </label>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.hooks}
              onChange={(e) => setHooks(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">
              使用 <code className="bg-muted px-1 rounded">@svton/hooks</code> React Hooks 工具库
            </span>
          </label>
        </div>
      )}

      {!hasAnySelected && (
        <p className="text-sm text-destructive">请至少选择一个子项目</p>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-2 border rounded-md font-medium hover:bg-accent transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          disabled={!hasAnySelected}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}
