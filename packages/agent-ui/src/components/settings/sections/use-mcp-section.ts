import { useState } from 'react';
import type { McpServerConfig } from '../settings-data.types';
import type { McpMarketServer, McpSectionProps } from './mcp-section.types';

export function useMcpSection(props: McpSectionProps) {
  const [tab, setTab] = useState<'config' | 'market'>('config');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [serverTools, setServerTools] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({ name: '', transport: props.supportsStdio ? 'stdio' as const : 'http' as const, command: '', args: '', url: '' });
  const [marketQuery, setMarketQuery] = useState('');
  const [marketResults, setMarketResults] = useState<McpMarketServer[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [installingName, setInstallingName] = useState<string | null>(null);
  const connectedNames = new Set(props.servers.map((server) => server.name));
  const toggleExpand = async (name: string) => {
    if (expandedServer === name) { setExpandedServer(null); return; }
    setExpandedServer(name);
    if (!serverTools[name] && props.getMcpServerTools) {
      const tools = await props.getMcpServerTools(name);
      setServerTools((current) => ({ ...current, [name]: tools }));
    }
  };
  const toggleTool = async (serverName: string, toolName: string, enabled: boolean) => {
    const config = props.configs.find((candidate) => candidate.name === serverName);
    if (!config || !props.updateMcpServerToolConfig) return;
    const current = config.disabledTools ?? [];
    const disabledTools = enabled
      ? current.filter((name) => name !== toolName)
      : [...current.filter((name) => name !== toolName), toolName];
    await props.updateMcpServerToolConfig(serverName, { disabledTools });
    props.onReload();
  };
  const setApprovalMode = async (serverName: string, approvalMode: 'auto' | 'ask' | 'deny') => {
    await props.updateMcpServerToolConfig?.(serverName, { approvalMode });
    props.onReload();
  };
  const addServer = async () => {
    if (!props.onAdd || !form.name.trim()) return;
    const config: McpServerConfig = {
      name: form.name.trim(),
      transport: form.transport,
      enabled: true,
      ...(form.transport === 'stdio'
        ? { command: form.command.trim(), args: form.args.trim() ? form.args.trim().split(/\s+/) : [] }
        : { url: form.url.trim() }),
    };
    await props.onAdd(config);
    setForm({ ...form, name: '', command: '', args: '', url: '' });
    setShowAdd(false);
    props.onReload();
  };
  const searchMarket = async () => {
    if (!props.searchMcpMarketplace) return;
    setMarketLoading(true);
    try { setMarketResults((await props.searchMcpMarketplace(marketQuery)).servers); }
    catch { setMarketResults([]); }
    finally { setMarketLoading(false); }
  };
  const installMarketServer = async (qualifiedName: string) => {
    if (!props.installFromMcpMarketplace) return;
    setInstallingName(qualifiedName);
    try {
      const result = await props.installFromMcpMarketplace(qualifiedName);
      if (result.success) props.onReload();
      else console.error('Install failed:', result.error);
    } finally { setInstallingName(null); }
  };
  return {
    tab, setTab, showAdd, setShowAdd, expandedServer, serverTools, form, setForm,
    marketQuery, setMarketQuery, marketResults, marketLoading, installingName,
    connectedNames, toggleExpand, toggleTool, setApprovalMode, addServer,
    searchMarket, installMarketServer,
  };
}
