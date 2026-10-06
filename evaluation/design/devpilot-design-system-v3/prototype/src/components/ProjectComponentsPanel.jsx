import { components, projectFacts } from '../view-models.js';
import { DataTable } from './DataTable.jsx';
import { Status } from './ui.jsx';

export function ProjectComponentsPanel({ go, openAction }) {
  return <><div className="aligned-analysis-summary"><strong>最近组件识别</strong><button className="link-button" onClick={() => go('repository')}>查看仓库分析</button><p>{projectFacts.latestAnalysis} · {projectFacts.latestAnalysisAt}</p></div>
    <DataTable label="项目组件" columns={['组件', '路径', '运行时', '端口', '状态', '操作']} className="project-components-table">
      {components.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.path}</td><td>{item.runtime}</td><td>{item.port}</td><td><Status value="success">{item.statusLabel}</Status></td><td><button className="table-action" onClick={() => openAction('component', item)}>查看组件</button></td></tr>)}
    </DataTable></>;
}
