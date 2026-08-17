import React from 'react';
import { cn, useI18n } from '@svton/ui';
import type { ToolInfo } from '../settings-data.types';
import { Badge, Card, FieldLabel, Toggle } from '../settings-ui';

export function PersonalizationSection({ value, onChange, onSave }: { value: string; onChange: (v: string) => void; onSave: () => void }) {
  const { translate: t } = useI18n();
  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">{t('settings.personalization.title')}</h2>
      <p className="text-xs text-gray-500 mb-6">{t('settings.personalization.description')}</p>
      <Card>
        <FieldLabel htmlFor="custom-instructions">{t('settings.personalization.instructions')}</FieldLabel>
        <p className="text-[10px] text-gray-600 mb-2">{t('settings.personalization.instructionsHelp')}</p>
        <textarea id="custom-instructions" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('settings.personalization.placeholder')} className="h-48 w-full resize-none rounded-lg border border-[#383838] bg-[#171717] p-3 text-sm text-gray-200 outline-none placeholder:text-gray-600 focus:border-cyan-600" />
        <div className="mt-3"><button onClick={onSave} className="min-h-11 rounded-lg bg-cyan-600 px-4 text-[12px] font-medium text-white hover:bg-cyan-500">{t('action.save')}</button></div>
      </Card>
    </div>
  );
}

export function ToolsListSection({ tools, disabledTools, hasAgent, onToggle }: { tools: ToolInfo[]; disabledTools: string[]; hasAgent: boolean; onToggle: (name: string) => void }) {
  const { translate } = useI18n();
  return (
    <div>
      <h2 className="text-lg text-white font-medium mb-1">{translate('settings.tool.title')}</h2>
      <p className="text-xs text-gray-500 mb-6">{translate('settings.tool.description')}</p>
      {!hasAgent ? <Card><div className="text-center py-6 text-gray-600 text-sm">{translate('settings.tool.noAgent')}</div></Card> :
      tools.length === 0 ? <Card><div className="text-center py-6 text-gray-600 text-sm">{translate('settings.tool.empty')}</div></Card> : (
        <Card className="!p-0 divide-y divide-[#2a2a2a]">
          {tools.map((t) => { const d = disabledTools.includes(t.name); return (
            <div key={t.name} className={cn('px-4 py-3 flex items-center gap-3 transition-opacity', d && 'opacity-40')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-sm text-gray-200 font-mono">{t.name}</span>{t.annotations?.readOnlyHint && <Badge color="green">{translate('settings.tool.readOnly')}</Badge>}{t.annotations?.destructiveHint && <Badge color="red">{translate('settings.tool.destructive')}</Badge>}</div>
                <div className="text-[11px] text-gray-500 truncate">{t.description}</div>
                {t.parameters?.properties && (<div className="mt-1 flex flex-wrap gap-1">{Object.keys(t.parameters.properties).map((p) => (<span key={p} className="text-[10px] font-mono bg-[#222] text-gray-500 px-1.5 py-0.5 rounded">{p}{t.parameters.required?.includes(p) && <span className="text-red-400">*</span>}</span>))}</div>)}
              </div>
              <Toggle checked={!d} onChange={() => onToggle(t.name)} label={t.name} />
            </div>
          ); })}
        </Card>
      )}
    </div>
  );
}

// ── Marketplace Section ─────────────────────────────────────
