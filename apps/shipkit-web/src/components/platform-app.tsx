'use client';
import type { Task } from '@/lib/contracts';
import { useApi } from '@/hooks/use-api';
import { useNavigation } from '@/hooks/use-navigation';
import { isBusy } from '@/lib/presentation';
import { EmptyPanel, ErrorMessage, LoadingPanel, PageHead } from './primitives';
import { WorkspaceShell } from './workspace-shell';
import { ProjectsPage } from './projects-page';
import { ProjectOverview } from './project-overview';
import { SettingsPage } from './settings-page';
import { HistoryPage } from './history-page';
import { ReleaseWorkspace } from './release-workspace';
import { AgentResourcesPage } from './agent-resources-page';

export function PlatformApp() {
  const { location, navigate } = useNavigation();
  const projectScope = location.view !== 'agents' && location.view !== 'projects';
  const projectQuery = useApi(projectScope && location.projectId ? 'GET:/projects/:id' : null, { id: location.projectId });
  const status = useApi(projectScope && location.projectId ? 'GET:/projects/:id/status' : null, { id: location.projectId }, projectScope ? 5000 : 0);
  const task = useApi(location.view === 'release' && location.taskId ? 'GET:/tasks/:id' : null, { id: location.taskId }, current => isBusy(current?.task) || current?.task.cleanupState === 'releasing' ? 900 : 0);
  const project = status.data?.project || projectQuery.data;
  const live = status.data?.live;
  const busy = location.view === 'release' && isBusy(task.data?.task);
  const refresh = () => { void status.mutate(); void task.mutate(); void projectQuery.mutate(); };
  const onTask = (value: Task) => navigate({ view: 'release', projectId: value.projectId, taskId: value.id, step: isBusy(value) ? 3 : 4 });
  const onOverview = () => navigate({ view: 'overview', taskId: '', step: 1 });
  const onNew = () => navigate({ view: 'release', taskId: '', step: 1 });
  let content: React.ReactNode;
  if (location.view === 'projects') content = <ProjectsPage onOpen={projectId => navigate({ view: 'overview', projectId, taskId: '' })} />;
  else if (location.view === 'agents') content = <AgentResourcesPage onProject={projectId => navigate({ view: 'settings', projectId, taskId: '' })} onProjects={() => navigate({ view: 'projects', projectId: '', taskId: '' })} />;
  else if (!location.projectId) content = <><PageHead title="连接与配置" description="选择本机项目后查看对应配置与连接。" onBack={() => navigate({ view: 'projects' })} /><EmptyPanel text="请先注册或选择一个项目。"><button className="button primary" onClick={() => navigate({ view: 'projects' })}>选择本机项目</button></EmptyPanel></>;
  else if (!project || !live) content = <><PageHead title={project?.name || '项目'} description="读取本机配置、Git 与运行 Agent 状态。" onBack={() => navigate({ view: 'projects', projectId: '', taskId: '' })} /><ErrorMessage error={status.error || projectQuery.error} />{status.error || projectQuery.error ? <EmptyPanel text="无法读取项目状态。核对本机配置与 Agent 连接后重试。"><button className="button secondary" onClick={refresh}>重试读取</button></EmptyPanel> : <LoadingPanel />}</>;
  else if (location.view === 'overview') content = <ProjectOverview project={project} live={live} onBack={() => navigate({ view: 'projects', projectId: '', taskId: '' })} onRelease={onNew} onHistory={() => navigate({ view: 'history', taskId: '' })} onSettings={() => navigate({ view: 'settings', taskId: '' })} onTask={onTask} />;
  else if (location.view === 'settings') content = <SettingsPage project={project} live={live} onBack={onOverview} onRefresh={refresh} />;
  else if (location.view === 'history') content = <HistoryPage project={project} onBack={onOverview} onNew={onNew} onTask={onTask} />;
  else content = <ReleaseWorkspace key={`${project.id}:${location.taskId || 'new'}`} project={project} live={live} location={location} detail={task.data} taskLoading={task.isLoading} taskError={task.error} navigate={navigate} refresh={refresh} />;
  return <WorkspaceShell view={location.view} busy={busy} navigate={navigate}>{content}</WorkspaceShell>;
}
