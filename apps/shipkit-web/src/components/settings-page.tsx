'use client';
import type { LiveProject, Project } from '@/lib/contracts';
import type { SettingsSection } from '@/hooks/use-navigation';
import { PageHead } from './primitives';
import { ProjectBreadcrumbs } from './project-breadcrumbs';
import { ProjectConnectionsSettings } from './project-connections-settings';
import { RepositorySettings } from './repository-settings';
import { EnvironmentConfigs } from './environment-configs';

const sections: Array<{ value: SettingsSection; label: string }> = [{ value: 'connections', label: '运行连接' }, { value: 'repository', label: '仓库' }, { value: 'variables', label: '环境变量' }];
export function SettingsPage({ project, live, onBack, onRefresh, section = 'connections', onSection }: {
  project: Project; live: LiveProject; onBack: () => void; onRefresh: () => void; section?: SettingsSection; onSection: (value: SettingsSection) => void;
}) {
  return <><ProjectBreadcrumbs project={project} current="连接与配置" /><PageHead title="连接与配置" description={project.name} onBack={onBack} backLabel="返回项目详情" />
    <nav className="project-settings-sections" aria-label="项目配置类型">{sections.map(item => <button key={item.value} aria-current={section === item.value ? 'page' : undefined} className={section === item.value ? 'active' : ''} onClick={() => onSection(item.value)}>{item.label}</button>)}</nav>
    <div className="settings-module">{section === 'connections' ? <ProjectConnectionsSettings project={project} live={live} onRefresh={onRefresh} /> : section === 'repository' ? <RepositorySettings key={project.id} project={project} onRefresh={onRefresh} /> : <EnvironmentConfigs key={project.id} project={project} live={live} />}</div>
  </>;
}
