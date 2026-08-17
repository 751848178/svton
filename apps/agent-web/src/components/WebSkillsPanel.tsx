'use client';

import React from 'react';
import type { SkillScope } from '@svton/agent-core';
import { useI18n, type TranslationKey } from '@svton/ui';
import Link from 'next/link';

interface SkillDefinition { name: string; description?: string; scope?: SkillScope }
const manageClass = 'inline-flex min-h-11 items-center rounded text-[11px] text-cyan-500 hover:text-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const scopeKeys: Record<SkillScope, TranslationKey> = {
  project: 'web.skills.scope.project',
  user: 'web.skills.scope.user',
  admin: 'web.skills.scope.admin',
  system: 'web.skills.scope.system',
};

export function WebSkillsPanel({ skills }: { skills: SkillDefinition[] }) {
  const { translate: t } = useI18n();
  return (
    <section aria-labelledby="skills-heading" className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="skills-heading" className="text-lg font-light text-white">{t('web.skills.title')}</h2>
        <Link href="/settings" className={manageClass}>{t('web.skills.manage')}</Link>
      </div>
      {skills.length === 0 ? <p className="text-sm text-gray-500">{t('web.skills.empty')}</p> : (
        <div className="space-y-2" data-testid="skill-list">{skills.map((skill) => (
          <div
            key={skill.name}
            className="rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] p-3"
            data-testid="skill-card"
            data-skill-name={skill.name}
            data-skill-scope={skill.scope}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{skill.name}</span>
              {skill.scope && <span className="rounded bg-cyan-900/30 px-1.5 py-0.5 text-[10px] text-cyan-400">{t(scopeKeys[skill.scope])}</span>}
            </div>
            {skill.description && <div className="mt-1 text-xs text-gray-500">{skill.description}</div>}
          </div>
        ))}</div>
      )}
    </section>
  );
}
