'use client';
import { useEffect } from 'react';
import { Select } from '@svton/ui';
import type { Project } from '@/lib/contracts';
import type { ConfigMode } from '@/lib/config-contracts';
import type { ReleaseController } from '@/hooks/use-release';
import { useApi } from '@/hooks/use-api';
import { ConfigStoreError } from './config-store-error';

export function ReleaseConfigPicker({ project, targetKey, first, control }: { project: Project; targetKey: string; first: boolean; control: ReleaseController }) {
  const versions = useApi(control.configMode === 'version' ? 'GET:/projects/:projectId/configs/:targetKey/versions' : null, { projectId: project.id, targetKey });
  const eligible = versions.data?.items.filter(version => !version.archivedAt) || [];
  useEffect(() => {
    if (!control.configVersionId || !versions.data || versions.error) return;
    const selected = eligible.find(version => version.id === control.configVersionId);
    if (!selected || control.selected.some(key => !selected.services.some(service => service.serviceKey === key))) control.setConfigVersionId('');
  }, [versions.data, versions.error, control.configVersionId, control.selected]);
  return <div className="release-config-picker"><div className="select-field"><label htmlFor="release-config-mode">运行环境配置</label><Select id="release-config-mode" value={control.configMode} disabled={control.busy} onChange={event => control.setConfigMode(event.target.value as ConfigMode)} options={[
    { value: 'inherit', label: '继承所选服务的当前配置', disabled: first || control.kind === 'config-only' }, { value: 'version', label: '应用冻结配置版本' }, ...(project.sourceKind !== 'repository' && control.kind !== 'config-only' ? [{ value: 'files', label: '使用已有 envFile 文件' }] : []),
  ]} /></div>
    {control.configMode === 'version' && <><ConfigStoreError error={versions.error} /><div className="select-field"><label htmlFor="release-config-version">配置版本</label><Select id="release-config-version" value={control.configVersionId} disabled={control.busy || versions.isLoading || !!versions.error} onChange={event => control.setConfigVersionId(event.target.value)} options={[{ value: '', label: versions.isLoading ? '正在读取配置版本…' : '请选择冻结版本' }, ...eligible.map(version => ({ value: version.id, label: `${version.name} · ${version.version}${control.selected.some(key => !version.services.some(service => service.serviceKey === key)) ? ' · 缺少所选服务配置' : ''}`, disabled: control.selected.some(key => !version.services.some(service => service.serviceKey === key)) }))]} /></div>
      {!versions.isLoading && !versions.error && !eligible.length && <p className="subtle">此环境还没有可用版本。创建草稿并冻结，可明确声明服务无需变量。</p>}{versions.error && <button className="button secondary small" type="button" onClick={() => void versions.mutate()}>重试读取版本</button>}</>}
    <p className="form-help">未选服务始终完整继承各自镜像与配置；冻结版本只应用本次所选服务。</p><button className="button ghost small" type="button" onClick={control.openConfigs} disabled={control.busy}>管理此项目的环境配置</button>
  </div>;
}
