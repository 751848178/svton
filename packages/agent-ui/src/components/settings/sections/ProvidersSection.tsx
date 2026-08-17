import React, { useState } from 'react';
import { CloseIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon, cn, useI18n } from '@svton/ui';
import type { ProviderInfo } from '../settings-data.types';
import { Badge, Card, FieldLabel, INPUT_CLS, SELECT_CLS } from '../settings-ui';

interface ProvidersSectionProps {
  providers: ProviderInfo[];
  showKey: Record<string, boolean>;
  setShowKey: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  showAddProvider: boolean;
  setShowAddProvider: (value: boolean) => void;
  newName: string; setNewName: (value: string) => void;
  newType: 'openai' | 'anthropic'; setNewType: (value: 'openai' | 'anthropic') => void;
  newUrl: string; setNewUrl: (value: string) => void;
  onSave: () => void | Promise<void>;
  onUpdate: (index: number, update: Partial<ProviderInfo>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  hasChanges: boolean;
}

export function ProvidersSection(props: ProvidersSectionProps) {
  const { translate: t } = useI18n();
  const [addingModelFor, setAddingModelFor] = useState<string | null>(null);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const addModel = (index: number) => {
    if (!newModelId.trim()) return;
    const provider = props.providers[index];
    props.onUpdate(index, { models: [...provider.models, { id: newModelId.trim(), name: newModelName.trim() || newModelId.trim() }] });
    setNewModelId(''); setNewModelName(''); setAddingModelFor(null);
  };
  const removeModel = (index: number, id: string) => props.onUpdate(index, { models: props.providers[index].models.filter((model) => model.id !== id) });
  return (
    <section aria-labelledby="providers-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 id="providers-heading" className="text-lg font-medium text-white">{t('settings.provider.title')}</h2><p className="mt-0.5 text-xs text-gray-500">{t('settings.provider.description')}</p></div>{props.hasChanges && <button onClick={() => void props.onSave()} className="min-h-11 rounded-lg bg-cyan-600 px-4 text-xs font-medium text-white">{t('settings.provider.save')}</button>}</div>
      <div className="space-y-4">{props.providers.map((provider, index) => <ProviderCard key={provider.id} provider={provider} index={index} props={props} adding={addingModelFor === provider.id} beginAdd={() => { setAddingModelFor(provider.id); setNewModelId(''); setNewModelName(''); }} cancelAdd={() => setAddingModelFor(null)} modelId={newModelId} setModelId={setNewModelId} modelName={newModelName} setModelName={setNewModelName} addModel={() => addModel(index)} removeModel={(id) => removeModel(index, id)} />)}</div>
      <AddProviderForm props={props} />
    </section>
  );
}

function ProviderCard({ provider, index, props, adding, beginAdd, cancelAdd, modelId, setModelId, modelName, setModelName, addModel, removeModel }: { provider: ProviderInfo; index: number; props: ProvidersSectionProps; adding: boolean; beginAdd: () => void; cancelAdd: () => void; modelId: string; setModelId: (value: string) => void; modelName: string; setModelName: (value: string) => void; addModel: () => void; removeModel: (id: string) => void }) {
  const { translate: t } = useI18n();
  const prefix = `provider-${index}`;
  const visible = props.showKey[provider.id] ?? false;
  return <Card><div className="mb-4 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><h3 className="truncate text-sm font-medium text-white">{provider.name}</h3><span className="rounded bg-[#222] px-1.5 py-0.5 text-[10px] uppercase text-gray-600">{provider.type}</span>{provider.apiKey && <Badge color="green">{t('settings.provider.configured')}</Badge>}</div><button aria-label={t('settings.provider.remove', { name: provider.name })} onClick={() => props.onRemove(index)} className="inline-flex size-11 items-center justify-center text-gray-500 hover:text-red-400 focus-visible:text-red-400"><TrashIcon size={14} aria-hidden="true" /></button></div>
    <div className="space-y-3"><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"><div><FieldLabel htmlFor={`${prefix}-name`}>{t('settings.provider.name')}</FieldLabel><input id={`${prefix}-name`} value={provider.name} onChange={(event) => props.onUpdate(index, { name: event.target.value })} className={INPUT_CLS} /></div><div><FieldLabel htmlFor={`${prefix}-type`}>{t('settings.provider.type')}</FieldLabel><select id={`${prefix}-type`} value={provider.type} onChange={(event) => props.onUpdate(index, { type: event.target.value })} className={SELECT_CLS}><option value="openai">{t('settings.provider.compatible')}</option><option value="anthropic">Anthropic</option></select></div></div>
      <div><FieldLabel htmlFor={`${prefix}-url`}>Base URL</FieldLabel><input id={`${prefix}-url`} value={provider.baseUrl} onChange={(event) => props.onUpdate(index, { baseUrl: event.target.value })} className={INPUT_CLS} /></div>
      <div><FieldLabel htmlFor={`${prefix}-key`}>API Key</FieldLabel><div className="relative"><input id={`${prefix}-key`} type={visible ? 'text' : 'password'} value={provider.apiKey} onChange={(event) => props.onUpdate(index, { apiKey: event.target.value })} className={cn(INPUT_CLS, 'pr-12')} /><button aria-label={t(visible ? 'settings.provider.hideKey' : 'settings.provider.showKey', { name: provider.name })} aria-pressed={visible} onClick={() => props.setShowKey((current) => ({ ...current, [provider.id]: !current[provider.id] }))} className="absolute right-0 top-0 inline-flex size-11 items-center justify-center text-gray-500">{visible ? <EyeOffIcon size={15} aria-hidden="true" /> : <EyeIcon size={15} aria-hidden="true" />}</button></div></div>
      <div><div className="mb-1 flex items-center justify-between"><span className="text-[11px] uppercase tracking-wider text-gray-500">{t('settings.provider.models')}</span><button onClick={beginAdd} className="inline-flex min-h-11 items-center gap-1 px-2 text-[11px] text-cyan-500"><PlusIcon size={13} aria-hidden="true" />{t('settings.provider.addModel')}</button></div><div className="space-y-1.5">{provider.models.map((model) => <div key={model.id} className="group flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-[#383838] bg-[#171717] px-2.5"><span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-300">{model.id}{model.name !== model.id && <span className="ml-2 text-[11px] text-gray-500">{model.name}</span>}</span><button aria-label={t('settings.provider.removeModel', { name: model.name })} onClick={() => removeModel(model.id)} className="inline-flex size-11 items-center justify-center text-gray-500 hover:text-red-400 focus-visible:text-red-400"><TrashIcon size={13} aria-hidden="true" /></button></div>)}{adding && <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"><label><span className="sr-only">{t('settings.provider.modelId')}</span><input value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder={t('settings.provider.modelId')} className={INPUT_CLS} /></label><label><span className="sr-only">{t('settings.provider.displayName')}</span><input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder={t('settings.provider.displayName')} className={INPUT_CLS} /></label><div className="flex gap-2 sm:col-span-2"><button onClick={addModel} disabled={!modelId.trim()} className="min-h-11 rounded-lg bg-cyan-600 px-3 text-[11px] text-white disabled:opacity-50">{t('action.add')}</button><button aria-label={t('action.cancel')} onClick={cancelAdd} className="inline-flex size-11 items-center justify-center text-gray-500"><CloseIcon size={14} aria-hidden="true" /></button></div></div>}</div></div>
    </div></Card>;
}

function AddProviderForm({ props }: { props: ProvidersSectionProps }) {
  const { translate: t } = useI18n();
  if (!props.showAddProvider) return <button onClick={() => props.setShowAddProvider(true)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#333] text-sm text-gray-500"><PlusIcon size={15} aria-hidden="true" />{t('settings.provider.new')}</button>;
  return <Card className="mt-4 !border-dashed"><h3 className="mb-3 text-sm text-gray-300">{t('settings.provider.new')}</h3><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"><div><FieldLabel htmlFor="new-provider-name">{t('settings.provider.name')}</FieldLabel><input id="new-provider-name" value={props.newName} onChange={(event) => props.setNewName(event.target.value)} className={INPUT_CLS} /></div><div><FieldLabel htmlFor="new-provider-type">{t('settings.provider.type')}</FieldLabel><select id="new-provider-type" value={props.newType} onChange={(event) => props.setNewType(event.target.value as 'openai' | 'anthropic')} className={SELECT_CLS}><option value="openai">{t('settings.provider.compatible')}</option><option value="anthropic">Anthropic</option></select></div><div className="sm:col-span-2"><FieldLabel htmlFor="new-provider-url">Base URL</FieldLabel><input id="new-provider-url" value={props.newUrl} onChange={(event) => props.setNewUrl(event.target.value)} className={INPUT_CLS} /></div></div><div className="mt-3 flex gap-2"><button onClick={props.onAdd} disabled={!props.newName.trim() || !props.newUrl.trim()} className="min-h-11 rounded-lg bg-cyan-600 px-4 text-xs text-white disabled:opacity-50">{t('action.add')}</button><button onClick={() => props.setShowAddProvider(false)} className="min-h-11 px-3 text-xs text-gray-500">{t('action.cancel')}</button></div></Card>;
}
