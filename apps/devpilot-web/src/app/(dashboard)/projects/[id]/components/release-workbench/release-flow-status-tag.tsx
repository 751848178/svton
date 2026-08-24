/**
 * PX-13：发布详情页徽章统一形态。
 * 绿/橙徽章（tinted 底 + 30% 透明边框）与灰徽章（实线边框、高 26px）不一致；
 * 本页统一为无边框（色底 + 文字），并以 h-6 固定 24px 总高（含透明边框盒），
 * 消除灰徽章 26px vs 绿/橙 24px 的高度差。全站策略另行决策。
 */
'use client';

import React from 'react';
import { StatusTag, type StatusTagProps } from '@/components/ui';

export function FlowStatusTag(props: StatusTagProps) {
  return (
    <StatusTag
      {...props}
      className={['border-transparent', 'h-6', props.className].filter(Boolean).join(' ')}
    />
  );
}
