'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { VariableBindingCollision } from './settings-variable-binding.model';

export function SettingsVariableCollisionAlert({
  collisions,
}: {
  collisions: VariableBindingCollision[];
}) {
  const t = useTranslations('projects');
  if (collisions.length === 0) return null;
  return (
    <div role="alert" className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
      <p className="font-medium">{t('configVariableCollisionTitle')}</p>
      {collisions.map((collision) => (
        <p key={collision.key}>
          <code>{collision.key}</code> · {collision.sources.join(' + ')}
        </p>
      ))}
    </div>
  );
}
