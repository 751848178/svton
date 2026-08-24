import React, { ReactNode, useState } from 'react';
import { cn } from '../../lib/utils';
import { useScrollbarMetrics, useThumbDrag } from './useScrollbar';

export interface ScrollAreaProps {
  children: ReactNode;
  maxHeight?: number | string;
  /** thumb 显隐策略：hover=悬停容器时显示（默认）；always=常显 */
  type?: 'hover' | 'always';
  className?: string;
}

/**
 * ScrollArea 滚动区域
 *
 * 原生滚动条在暗色主题下为系统白条、跨平台不一致 —— 改为自绘 track/thumb：
 * 原生滚动保留（惯性/触控板/键盘可用，scrollbar-none 隐藏原生条），
 * 视觉层叠加可拖拽 thumb（hover 显隐），滚动行为零劫持。
 */
export function ScrollArea(props: ScrollAreaProps) {
  const { children, maxHeight, type = 'hover', className } = props;
  const { viewportRef, metrics, measure } = useScrollbarMetrics();
  const dragY = useThumbDrag({ viewportRef, axis: 'y' });
  const dragX = useThumbDrag({ viewportRef, axis: 'x' });
  const [focusedViaPointer, setFocusedViaPointer] = useState(false);

  const showThumb = type === 'always' || focusedViaPointer;

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ maxHeight }}
      onMouseEnter={() => setFocusedViaPointer(true)}
      onMouseLeave={() => setFocusedViaPointer(false)}
      data-svton-scroll-area=""
    >
      <div
        ref={viewportRef}
        onScroll={measure}
        className="max-h-full overflow-auto scrollbar-none"
        style={{ maxHeight }}
      >
        {children}
      </div>

      {metrics.hasVertical && (
        <div
          aria-hidden="true"
          className="absolute inset-y-1 right-0.5 w-1.5 rounded-full bg-foreground/5"
          data-testid="scrollbar-y"
        >
          <div
            onPointerDown={dragY}
            className={cn(
              'absolute w-full rounded-full bg-muted-foreground/40 transition-opacity hover:bg-muted-foreground/60',
              showThumb ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              height: `${metrics.vSize}%`,
              top: `${(metrics.vOffset / 100) * (100 - metrics.vSize)}%`,
            }}
          />
        </div>
      )}

      {metrics.hasHorizontal && (
        <div
          aria-hidden="true"
          className="absolute inset-x-1 bottom-0.5 h-1.5 rounded-full bg-foreground/5"
          data-testid="scrollbar-x"
        >
          <div
            onPointerDown={dragX}
            className={cn(
              'absolute h-full rounded-full bg-muted-foreground/40 transition-opacity hover:bg-muted-foreground/60',
              showThumb ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              width: `${metrics.hSize}%`,
              left: `${(metrics.hOffset / 100) * (100 - metrics.hSize)}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
