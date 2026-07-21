import { getTranslations } from 'next-intl/server';
import { LoadingState } from '@svton/ui';

/**
 * (dashboard) 路由段切换时的全局加载态。
 *
 * 渲染在 dashboard layout 的 <main> 内，垂直水平居中于主内容区。
 * LoadingState 用法与现有页面一致（如 servers/page.tsx）：
 * 只传 text，保持默认 spinner 与居中行为。
 */
export default async function DashboardLoading() {
  const t = await getTranslations('common');

  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <LoadingState text={t('loading')} />
    </div>
  );
}
