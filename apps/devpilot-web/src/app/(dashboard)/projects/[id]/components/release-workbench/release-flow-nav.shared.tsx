/**
 * 链路导航共享原语：步骤条与环境发布链共用的状态图标 + 列表键盘导航。
 */
'use client';

import { CheckCircle, Circle, CircleNotch, WarningOctagon } from '@phosphor-icons/react';
import clsx from 'clsx';
import type { ReleaseWorkbenchStepState } from './release-workbench-steps.model';

export type FlowNodeState = 'current' | 'done' | 'waiting' | 'blocked';

export function FlowNodeIcon({
  state,
  size = 20,
}: {
  state: FlowNodeState | ReleaseWorkbenchStepState;
  size?: number;
}) {
  // PX-10：步骤条的 'completed' 与链路的 'done' 同为完成态，统一按 done 渲染
  // （实心语义的 CheckCircle），避免完成步骤显示成进行中的开口圆环。
  const normalized = state === 'completed' ? 'done' : state;
  const className = clsx(
    'shrink-0',
    normalized === 'done' && 'text-emerald-600',
    normalized === 'current' && 'text-primary',
    normalized === 'blocked' && 'text-destructive',
    normalized === 'waiting' && 'text-muted-foreground',
  );
  if (normalized === 'done')
    return (
      <CheckCircle
        aria-hidden="true"
        className={className}
        size={size}
      />
    );
  if (normalized === 'waiting')
    return (
      <Circle
        aria-hidden="true"
        className={className}
        size={size}
      />
    );
  if (normalized === 'blocked')
    return (
      <WarningOctagon
        aria-hidden="true"
        className={className}
        size={size}
        weight="fill"
      />
    );
  return (
    <CircleNotch
      aria-hidden="true"
      className={className}
      size={size}
    />
  );
}

/** tablist 按钮的 Home/End/方向键循环导航；不处理时返回 null。 */
export function flowKeyboardTarget(key: string, index: number, length: number) {
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + length) % length;
  return null;
}
