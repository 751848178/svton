import React from 'react';
import { useI18n } from '@svton/ui';
import type { useMcpSection } from './use-mcp-section';
import { Badge, Card, INPUT_CLS } from '../settings-ui';

type Model = ReturnType<typeof useMcpSection>;

export function McpMarketplace({ model }: { model: Model }) {
  const { formatNumber, translate: t } = useI18n();
  return (
    <div>
      <form onSubmit={(event) => { event.preventDefault(); void model.searchMarket(); }} className="mb-4 flex min-w-0 gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">{t('settings.mcp.search')}</span><input value={model.marketQuery} onChange={(event) => model.setMarketQuery(event.target.value)} placeholder={t('settings.mcp.searchPlaceholder')} className={INPUT_CLS} /></label>
        <button type="submit" disabled={model.marketLoading} className="min-h-11 shrink-0 rounded-lg bg-cyan-600 px-4 text-[11px] font-medium text-white disabled:opacity-50">{t(model.marketLoading ? 'settings.mcp.searching' : 'action.search')}</button>
      </form>
      {model.marketResults.length > 0 ? <div className="space-y-2">{model.marketResults.map((server) => (
        <Card key={server.id} className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium text-gray-200">{server.displayName || server.qualifiedName}</span>{server.verified && <Badge color="green">{t('settings.mcp.verified')}</Badge>}</div><p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{server.description}</p><p className="mt-1.5 text-[10px] text-gray-600">{t(server.useCount === 1 ? 'settings.mcp.installCountOne' : 'settings.mcp.installCount', { count: formatNumber(server.useCount) })}</p></div>
          <button onClick={() => model.installMarketServer(server.qualifiedName)} disabled={model.installingName === server.qualifiedName} className="min-h-11 shrink-0 rounded-lg border border-cyan-800 px-3 text-[11px] font-medium text-cyan-400 disabled:opacity-50">{t(model.installingName === server.qualifiedName ? 'settings.marketplace.installing' : 'settings.marketplace.install')}</button>
        </Card>
      ))}</div> : <Card><p className="py-8 text-center text-sm text-gray-600">{t(model.marketLoading ? 'settings.mcp.searching' : 'settings.mcp.searchPrompt')}</p></Card>}
    </div>
  );
}
