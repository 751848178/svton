import { ArrowRight, CheckCircle, Warning } from '@phosphor-icons/react';
import { DataTableSurface } from '../components/DataTable.jsx';
import { Button, ScreenTitle, Status } from '../components/ui.jsx';

export function DomainsScreen({ go, openAction, domainFixed }) {
  return (
    <>
      <ScreenTitle
        title="域名与入口"
        description="为项目组件建立环境级访问入口；TLS、DNS 与探测结果随变更保留审计记录。"
        actions={domainFixed
          ? <Button variant="secondary" onClick={() => go('release')}>返回发布检查 <ArrowRight size={16} /></Button>
          : <Button onClick={() => openAction('editDomain')}>配置生产入口 <ArrowRight size={16} /></Button>}
      />

      <section className={`domain-overview ${domainFixed ? 'resolved' : ''}`}>
        <span className="domain-symbol">{domainFixed ? <CheckCircle size={22} weight="fill" /> : <Warning size={22} weight="fill" />}</span>
        <div><h3>{domainFixed ? '生产入口草案已保存，等待检查' : '生产环境缺少 web 入口'}</h3><p>{domainFixed ? 'picshare.acme.dev · web:3000 · 自动 TLS · 发布后探测' : '没有入口时生产部署即使完成也无法被用户访问。'}</p></div>
        <Button variant="secondary" onClick={() => openAction('editDomain')}>{domainFixed ? '编辑入口草案' : '配置生产入口'} <ArrowRight size={15} /></Button>
      </section>

      <DataTableSurface title="项目入口" meta="当前项目的环境与组件入口" columns={['域名', '环境', '目标', 'TLS', 'DNS / 探测', '状态', '操作']} tableClassName="domains-table">
        <tr><td className="mono">{domainFixed ? 'picshare.acme.dev' : '—'}</td><td>生产环境</td><td>web · / · 3000</td><td>{domainFixed ? '待签发' : '—'}</td><td>{domainFixed ? '等待检查' : '未配置'}</td><td><Status value={domainFixed ? 'warning' : 'blocked'}>{domainFixed ? '待验证' : '缺失'}</Status></td><td><button className="table-action" onClick={() => openAction('editDomain')}>编辑入口</button></td></tr>
      </DataTableSurface>
    </>
  );
}
