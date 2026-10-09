'use client';
import { Box, ExternalLink, Server } from 'lucide-react';
import type { LiveProject, Project } from '@/lib/contracts';
import { portLabel } from '@/lib/presentation';
import { Status } from './primitives';
import { ImageReference } from './image-reference';
import { ConfigReference } from './config-reference';

export function ServiceTable({ project, live, selected, onToggle, locked }: {
  project: Project; live: LiveProject; selected?: string[]; onToggle?: (service: string) => void; locked?: boolean;
}) {
  return <div className="table-wrap"><table className={`service-table deployment-services ${selected ? 'selectable' : ''}`}><thead><tr>
    {selected && <th aria-label="选择服务" />}<th>服务</th><th>当前镜像</th><th>端口</th><th>{selected ? '本次范围' : '状态'}</th>
  </tr></thead><tbody>{live.services.map(service => {
    const metadata = project.services.find(item => item.serviceKey === service.serviceKey);
    const entry = metadata?.entryUrl && /^https?:\/\//.test(metadata.entryUrl) ? metadata.entryUrl : null;
    const included = selected?.includes(service.serviceKey);
    return <tr key={service.serviceKey} className={included ? 'is-selected' : ''}>
      {selected && <td className="check-cell"><input type="checkbox" checked={included} disabled={locked} onChange={() => onToggle?.(service.serviceKey)} aria-label={`选择 ${service.serviceKey}`} /></td>}
      <td className="service-cell"><div className="service-name">{service.serviceKey.includes('api') || service.serviceKey === 'backend' ? <Server size={18} aria-hidden="true" /> : <Box size={18} aria-hidden="true" />}
        <div>{entry ? <a className="service-entry" href={entry} target="_blank" rel="noopener noreferrer"><span className="service-entry-heading">{service.serviceKey}<ExternalLink size={12} aria-hidden="true" /></span><span className="service-copy">{metadata?.displayName || '打开服务入口'}</span></a> : <><strong>{service.serviceKey}</strong><span className="service-copy">{metadata?.displayName || '未设置服务入口'}</span></>}</div>
      </div></td>
      <td className="image-cell" data-label="当前镜像"><ImageReference value={service.currentImage} />{service.configRef && <p className="service-config-reference"><ConfigReference value={service.configRef} /></p>}</td><td className="mono" data-label="端口">{portLabel(service.spec)}</td>
      <td data-label={selected ? '本次范围' : '状态'}>{selected ? <span className={`tag ${included ? 'good' : 'neutral'}`}>{included ? '更新' : '继承当前版本'}</span> : <Status value={live.runtime.check.ok ? null : 'unavailable'} label={live.runtime.check.ok ? service.currentImage ? '已部署' : '尚未部署' : '状态未知'} />}</td>
    </tr>;
  })}</tbody></table></div>;
}
