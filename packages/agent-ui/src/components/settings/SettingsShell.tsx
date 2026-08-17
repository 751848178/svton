import React from 'react';
import type { ReactNode } from 'react';
import { ChevronIcon, PopoutIcon, useI18n } from '@svton/ui';
import { useResponsiveBand } from '../layout/use-responsive-band';
import type { ISettingsAdapter } from './settings-adapter.types';
import type { SettingsSectionDef, SettingsSectionId } from './settings-navigation';
import { SettingsNav } from './SettingsNav';

interface SettingsShellProps {
  adapter: ISettingsAdapter;
  sections: SettingsSectionDef[];
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  onBack: () => void;
  status?: ReactNode;
  children: ReactNode;
}

export function SettingsShell({ adapter, sections, activeSection, onSectionChange, onBack, status, children }: SettingsShellProps) {
  const { translate: t } = useI18n();
  const band = useResponsiveBand();
  return (
    <div data-testid="settings-shell" data-responsive-band={band} className="flex h-screen h-[100dvh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground">
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2"><button onClick={onBack} className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-muted-foreground hover:text-foreground"><ChevronIcon size={14} className="rotate-180" aria-hidden="true" />{t('settings.navigation.back')}</button><span aria-hidden="true" className="text-muted-foreground">/</span><h1 className="truncate text-sm font-medium">{t('settings.navigation.title')}</h1></div>
        {adapter.openInEditor && <button onClick={() => adapter.openInEditor?.()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-control px-3 text-[11px] text-muted-foreground hover:text-foreground"><PopoutIcon size={13} aria-hidden="true" /><span className="hidden sm:inline">{t('settings.navigation.openEditor')}</span></button>}
      </header>
      {status}
      {band !== 'wide' && <SettingsNav band={band} sections={sections} activeSection={activeSection} onSectionChange={onSectionChange} />}
      <div className="flex min-h-0 min-w-0 flex-1">
        {band === 'wide' && <SettingsNav band={band} sections={sections} activeSection={activeSection} onSectionChange={onSectionChange} />}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-6 sm:py-6">{children}</div></main>
      </div>
    </div>
  );
}
