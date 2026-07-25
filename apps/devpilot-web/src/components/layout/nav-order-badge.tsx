import { cn } from '@/lib/utils';

/**
 * 旅程序号徽标(A19,IA 审计 §3.2)。
 *
 * 仅在「资源」分区启用,在 label 前渲染一个弱视觉序号(圆形描边数字),
 * 暗示用户应按 1→2→3… 顺序操作。纯展示,不改路由、不改 labelKey 文案。
 *
 * 设计取舍:序号写在 i18n 文案里会污染搜索匹配(如「1. 资源申请」无法被「资源」命中),
 * 故单独抽成徽标组件,labelKey 保持干净的短词。
 *
 * 活跃态用主色描边加深,弱化但可见;非活跃态用 muted 边框。
 */
export function NavOrderBadge({
  order,
  active,
  className,
}: {
  order: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold leading-none tabular-nums',
        active
          ? 'border-sidebar-primary text-sidebar-primary'
          : 'border-sidebar-border text-muted-foreground',
        className,
      )}
    >
      {order}
    </span>
  );
}
