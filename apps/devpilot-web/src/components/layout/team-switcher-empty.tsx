'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

/** 无团队时只表达全局状态，创建动作由团队前置页面唯一承载。 */
export function TeamSwitcherEmpty() {
  const t = useTranslations('nav');

  return (
    <div className="flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs text-muted-foreground">
      {t('noTeamHint')}
    </div>
  );
}
