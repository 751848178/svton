import type { RepositoryPreview as Preview } from '@/lib/source-contracts';

export function RepositoryPreview({ value }: { value: Preview }) {
  const source = value.sourceSnapshot;
  return <div className="repository-preview"><h3>已读取发布定义</h3><dl className="context-list"><dt>应用</dt><dd>{source.appName}</dd><dt>源码引用</dt><dd>{source.requestedRef.kind} · {source.requestedRef.value}</dd><dt>确定提交</dt><dd className="mono source-commit" title={source.commit}>{source.commit}</dd><dt>发布定义</dt><dd>{source.specPath}</dd></dl>
    <div className="table-wrap"><table className="repository-services"><thead><tr><th>服务</th><th>Dockerfile</th><th>构建上下文</th></tr></thead><tbody>{Object.entries(source.spec.services).map(([key, service]) => <tr key={key}><td data-label="服务">{key}</td><td data-label="Dockerfile">{service.dockerfile || 'Dockerfile'}</td><td data-label="构建上下文">{service.context || '.'}</td></tr>)}</tbody></table></div>
  </div>;
}
