import { ArrowLeft, ArrowRight, GearSix, GitBranch, GithubLogo, Warning } from '@phosphor-icons/react';
import { projectHeader as project } from '../view-models.js';
import { Button } from './ui.jsx';

export function ProjectFrame({ screen, go, openAction, domainFixed, children }) {
  const overview = screen === 'overview';
  return <main className="project-stage aligned-workspace">
    <header className="project-header aligned-project-header">
      <div className="project-identity"><button className="icon-button" aria-label={overview ? '返回我的项目' : '返回项目首页'} onClick={() => go(overview ? 'directory' : 'overview')}><ArrowLeft size={19} /></button>
        <div><h1>{project.name}</h1><div className="project-meta"><span><GithubLogo size={14} />{project.repo}</span><span><GitBranch size={14} />{project.branch}</span></div></div>
      </div>
      <div className="aligned-header-actions">{overview && <Button variant="secondary" onClick={() => go('config')}><GearSix size={16} />项目配置</Button>}<Button onClick={() => openAction('createRelease')}>创建发布 <ArrowRight size={15} /></Button></div>
    </header>
    {overview && !domainFixed && <div className="aligned-project-issue" role="status"><Warning size={18} /><p>生产入口尚未配置，发布 R-1042 暂时无法进入生产。<button className="link-button" onClick={() => openAction('editDomain')}>配置生产入口</button></p></div>}
    <div className="screen-body">{children}</div>
  </main>;
}
