/**
 * Suspense 类型断言包装
 *
 * 单一职责：绕过 React 19 类型下 Suspense 跨包 JSX 校验差异（TS2786）。
 * 仅做类型层面的断言，运行时仍是原始 Suspense。
 */

import type { ReactElement, ReactNode } from 'react';
import { Suspense as ReactSuspense } from 'react';

export const TypedSuspense = ReactSuspense as unknown as (props: {
  fallback: ReactNode;
  children: ReactNode;
}) => ReactElement;
