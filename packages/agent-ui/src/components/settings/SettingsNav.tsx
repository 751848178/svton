import React, { useMemo, useState } from 'react';
import { SearchIcon, cn, useI18n } from '@svton/ui';
import type { ResponsiveBand } from '../layout/use-responsive-band';
import {
  SettingsNavigationIcon,
  type SettingsSectionDef,
  type SettingsSectionId,
} from './settings-navigation';

interface SettingsNavProps {
  band: ResponsiveBand;
  sections: SettingsSectionDef[];
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
}

export function SettingsNav({ band, sections, activeSection, onSectionChange }: SettingsNavProps) {
  const { translate: t } = useI18n();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? sections.filter((section) => section.label.toLowerCase().includes(normalized)) : sections;
  }, [query, sections]);
  const groups = useMemo(() => Array.from(new Set(filtered.map((section) => section.group))), [filtered]);
  if (band !== 'wide') return (
    <label className="shrink-0 px-3 py-2"><span className="mb-1 block text-[11px] text-muted-foreground">{t('settings.navigation.category')}</span><select aria-label={t('settings.navigation.category')} value={activeSection} onChange={(event) => onSectionChange(event.target.value as SettingsSectionId)} className="min-h-11 w-full rounded-md border border-control bg-muted px-3 text-sm text-foreground">{sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
  );
  return (
    <nav aria-label={t('settings.navigation.category')} className="flex w-52 shrink-0 flex-col border-r border-border">
      <label className="px-3 pb-2 pt-3"><span className="sr-only">{t('settings.navigation.search')}</span><span className="flex min-h-11 items-center gap-2 rounded-md border border-control bg-muted px-2.5"><SearchIcon size={14} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('settings.navigation.searchPlaceholder')} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" /></span></label>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">{groups.map((group) => <div key={group} className="mt-3 first:mt-0"><p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{group}</p>{filtered.filter((section) => section.group === group).map((section) => <button key={section.id} aria-current={activeSection === section.id ? 'page' : undefined} onClick={() => onSectionChange(section.id)} className={cn('flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]', activeSection === section.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}><SettingsNavigationIcon id={section.id} />{section.label}</button>)}</div>)}</div>
    </nav>
  );
}
