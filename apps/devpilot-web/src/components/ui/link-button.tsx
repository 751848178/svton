/**
 * LinkButton 按钮样式的导航链接
 *
 * 供服务端组件（RSC）页面使用：当需要一个按钮外观但行为是跳转时，无法用带 onClick
 * 的 Button，改用本组件——它复用 buttonVariants 样式，内部渲染 next/link。
 *
 * 单一职责：把 buttonVariants 样式套到 <Link> 上。无业务逻辑。
 */

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants, type ButtonVariantProps } from './button';

export interface LinkButtonProps
  extends Omit<React.ComponentProps<typeof Link>, 'className'>,
    ButtonVariantProps {
  className?: string;
}

/** 按钮样式的导航链接（用于 RSC 页面）。 */
export function LinkButton(props: LinkButtonProps) {
  const { variant, size, block, className, children, ...rest } = props;
  return (
    <Link
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
