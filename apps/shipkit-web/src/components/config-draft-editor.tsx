'use client';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ConfigDraft, ConfigVersion } from '@/lib/config-contracts';
import { variablePatches, variableRows, type VariableRow } from '@/lib/config-form';
import { request } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import { ConfigStoreError } from './config-store-error';
import { ConfigVariableEditor } from './config-variable-editor';
import { ConfigDifference } from './config-difference';

export function ConfigDraftEditor({ draft, nextVersion, onSaved, onFrozen, onClose }: { draft: ConfigDraft; nextVersion: string; onSaved: (value: ConfigDraft) => void; onFrozen: (value: ConfigVersion) => void; onClose: () => void }) {
  const scope = { projectId: draft.projectId, targetKey: draft.targetKey, id: draft.id };
  const [name, setName] = useState(draft.name);
  const [defaults, setDefaults] = useState(variableRows(draft.defaults));
  const [services, setServices] = useState(draft.services.map(service => ({ ...service, rows: variableRows(service.variables) })));
  const [version, setVersion] = useState(nextVersion);
  const [dirty, setDirty] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [pendingImports, setPendingImports] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const preview = useApi(!dirty && draft.status === 'draft' ? 'GET:/projects/:projectId/configs/:targetKey/drafts/:id/preview' : null, { ...scope, etag: draft.etag });
  const previewMatches = !!preview.data && preview.data.etag === draft.etag;
  const importing = (value: boolean) => setPendingImports(current => current + (value ? 1 : -1));
  const change = (operation: () => void) => { operation(); setDirty(true); setError(null); };
  const serviceRows = (serviceKey: string, rows: VariableRow[]) => change(() => setServices(current => current.map(service => service.serviceKey === serviceKey ? { ...service, rows } : service)));
  const run = async (kind: string, operation: () => Promise<void>) => { if (action || pendingImports) return; setAction(kind); setError(null); try { await operation(); } catch (failure) { setError(failure); } finally { setAction(null); } };
  const save = () => run('save', async () => {
    if (!name.trim()) throw new Error('请输入配置名称。');
    const value = await request('PATCH:/projects/:projectId/configs/:targetKey/drafts/:id', { ...scope, etag: draft.etag, name: name.trim(), defaults: variablePatches(defaults), services: services.map(service => ({ serviceKey: service.serviceKey, noEnv: service.noEnv, ...(service.noEnv ? {} : { variables: variablePatches(service.rows) }) })) });
    onSaved(value);
  });
  const freeze = () => run('freeze', async () => { onFrozen(await request('POST:/projects/:projectId/configs/:targetKey/drafts/:id/freeze', { ...scope, etag: draft.etag, version: version.trim() })); });
  const readOnly = draft.status !== 'draft';
  const busy = action !== null || pendingImports > 0;
  return <section className="panel config-draft"><div className="panel-head"><div><h2>编辑配置草稿</h2><p className="subtle">保存与冻结不会修改线上。公共默认变量在冻结时展开，服务同名变量覆盖公共值。</p></div><button className="button ghost small" onClick={onClose} disabled={busy}>返回配置列表</button></div>
    <div className="panel-body config-form"><ConfigStoreError error={error} />{readOnly && <p className="notice-message">此草稿已冻结，请基于对应版本创建新草稿。</p>}
      <label>配置名称<input value={name} onChange={event => change(() => setName(event.target.value))} disabled={busy || readOnly} /></label>
      <div className="config-service-editor"><h3>公共默认变量</h3><ConfigVariableEditor onImporting={importing} rows={defaults} onChange={rows => change(() => setDefaults(rows))} disabled={busy || readOnly} prefix="公共默认变量" /></div>
      {services.map((service, index) => <details className="config-service-editor" key={service.serviceKey} open={index === 0}><summary><ChevronRight size={16} aria-hidden="true" /><strong>{service.serviceKey}</strong><span className="subtle">{service.noEnv ? '明确无需变量' : `${service.rows.filter(row => row.mode !== 'delete').length} 个服务变量`}</span></summary>
        <label className="inline-checkbox"><input type="checkbox" checked={service.noEnv} disabled={busy || readOnly} onChange={event => change(() => setServices(current => current.map(item => item.serviceKey === service.serviceKey ? { ...item, noEnv: event.target.checked } : item)))} />此服务无需环境变量（不应用公共默认值）</label>
        {!service.noEnv && <ConfigVariableEditor onImporting={importing} rows={service.rows} onChange={rows => serviceRows(service.serviceKey, rows)} disabled={busy || readOnly} prefix={service.serviceKey} />}
      </details>)}
      <p className="form-help">运行变量不注入镜像构建。NEXT_PUBLIC_*、VITE_* 等构建期变量需要修改发布定义并重新构建。</p>
      <div className="config-saved-preview"><h3>保存草稿与基础版本的差异</h3>{dirty ? <p className="subtle">先保存草稿，再核对本次修改。</p> : <><ConfigStoreError error={preview.error} />{preview.isLoading ? <p className="subtle" role="status">正在比较已保存的草稿…</p> : previewMatches && preview.data && Object.entries(preview.data.services).map(([key, difference]) => <div className="config-preview-row" key={key}><strong>{key}</strong><ConfigDifference value={difference} /></div>)}{!previewMatches && !preview.isLoading && <button type="button" className="button secondary small" disabled={busy} onClick={() => void preview.mutate()}>重新读取此版本差异</button>}</>}</div>
      <label>冻结版本号<input value={version} onChange={event => setVersion(event.target.value)} placeholder="0.0.1" disabled={busy || readOnly} inputMode="decimal" /><span className="form-help">使用主版本.次版本.修订号；冻结后不可修改，发布时选择此版本。</span></label>
      <div className="form-actions"><button className={`button ${dirty ? 'primary' : 'secondary'}`} onClick={() => void save()} disabled={busy || readOnly || !dirty}>{action === 'save' ? '正在保存…' : '保存草稿'}</button><button className={`button ${dirty ? 'secondary' : 'primary'}`} onClick={() => void freeze()} disabled={busy || readOnly || dirty || !version.trim() || !previewMatches || !!preview.error || preview.isLoading}>{action === 'freeze' ? '正在冻结…' : '冻结为版本'}</button></div>
    </div>
  </section>;
}
